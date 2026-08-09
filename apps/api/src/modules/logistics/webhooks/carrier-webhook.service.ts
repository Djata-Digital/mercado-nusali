import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CarrierProviderFactory } from '../providers/carrier-provider.factory';
import { SecretsEncryptionService } from '../security/secrets-encryption.service';
import { TrackingStateMachineService } from '../tracking/tracking-state-machine.service';
import { CarrierWebhookStatus, TrackingStatus, CarrierStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class CarrierWebhookService {
  private readonly logger = new Logger(CarrierWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: CarrierProviderFactory,
    private readonly secretsEncryption: SecretsEncryptionService,
    private readonly stateMachine: TrackingStateMachineService,
    @Optional() @InjectQueue('carrier-webhook-processing') private readonly webhookQueue?: Queue,
  ) {}

  private getCanonicalJson(obj: any): string {
    if (obj === null || obj === undefined) return '';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map((item) => this.getCanonicalJson(item)).join(',') + ']';
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map((key) => `${JSON.stringify(key)}:${this.getCanonicalJson(obj[key])}`);
    return '{' + parts.join(',') + '}';
  }

  /**
   * Recebe, valida a assinatura com o secret da transportadora, deduplica e enfileira um webhook no BullMQ.
   * Rejeita estritamente conexões com credenciais inválidas ou assinaturas divergentes.
   */
  async handleWebhook(carrierCode: string, headers: Record<string, any>, payload: any) {
    const carrier = await this.prisma.carrier.findUnique({
      where: { code: carrierCode.toUpperCase() },
      include: { accounts: true },
    });

    if (!carrier) {
      throw new NotFoundException(`Transportadora '${carrierCode}' não encontrada.`);
    }

    // 1. Obter conta ativa e resolver o provedor técnico logístico via providerType
    const activeAccount = carrier.accounts.find(
      (acc) => (acc as any).status === 'ACTIVE' || (acc as any).status === CarrierStatus.ACTIVE,
    );

    if (!activeAccount) {
      throw new BadRequestException(`Nenhuma conta ativa encontrada para a transportadora '${carrier.name}'.`);
    }

    if (!activeAccount.webhookSecretEncrypted) {
      throw new BadRequestException(`Segredo de webhook não configurado para a conta da transportadora.`);
    }

    // 2. Descriptografar secret. Qualquer falha rejeita imediatamente o webhook
    let secret: string;
    try {
      let secretObj: any;
      try {
        secretObj = JSON.parse(activeAccount.webhookSecretEncrypted);
      } catch {
        secretObj = activeAccount.webhookSecretEncrypted;
      }
      secret = typeof secretObj === 'object' ? this.secretsEncryption.decrypt(secretObj) : secretObj;
    } catch (err: any) {
      this.logger.error(`Erro ao descriptografar webhookSecretEncrypted para ${carrier.code}: ${err.message}`);
      throw new BadRequestException('Falha na descriptografia das credenciais do webhook.');
    }

    // Resolve o provider técnico logístico via providerType
    const providerType = activeAccount.providerType || carrier.providerType || carrier.code;
    const provider = this.providerFactory.getProvider(providerType);

    // 3. Validar assinatura com a ordem estrita dos argumentos (headers, payload, secret)
    let isValid = false;
    try {
      isValid = await provider.validateWebhook(headers, payload, secret);
    } catch (err: any) {
      this.logger.error(`Erro na execução da validação do webhook (${carrier.code}): ${err.message}`);
      throw new BadRequestException('Falha na validação de assinatura do webhook.');
    }

    if (!isValid) {
      throw new BadRequestException('Assinatura de webhook de transportadora inválida.');
    }

    // 4. Hash de deduplicação idempotente sem incluir headers variáveis
    const externalEventId = payload.eventId || payload.id || null;
    let signatureHash: string;

    if (externalEventId) {
      signatureHash = crypto.createHash('sha256').update(`${carrier.id}:${externalEventId}`).digest('hex');
    } else {
      const trackingNumber = payload.trackingNumber || payload.tracking_code || '';
      const eventCode = payload.eventCode || payload.code || payload.status || '';
      const eventAt = payload.eventAt || payload.timestamp || '';
      const canonicalPayload = this.getCanonicalJson(payload);
      signatureHash = crypto
        .createHash('sha256')
        .update(`${carrier.id}:${trackingNumber}:${eventCode}:${eventAt}:${canonicalPayload}`)
        .digest('hex');
    }

    // Verificar se o evento já foi gravado no banco de dados
    const existing = await this.prisma.carrierWebhookEvent.findUnique({
      where: { carrierId_signatureHash: { carrierId: carrier.id, signatureHash } },
    });

    if (existing) {
      return { accepted: true, duplicate: true, eventId: existing.id };
    }

    // Sanitizar os headers antes de salvar no banco de dados
    const sanitizedHeaders = { ...headers };
    delete sanitizedHeaders['authorization'];
    delete sanitizedHeaders['cookie'];
    delete sanitizedHeaders['x-api-key'];

    // 5. Persistir o evento com status RECEIVED
    const event = await this.prisma.carrierWebhookEvent.create({
      data: {
        carrierId: carrier.id,
        externalEventId,
        trackingNumber: payload.trackingNumber || payload.tracking_code || null,
        signatureHash,
        payloadJson: payload as any,
        headersJsonSanitized: sanitizedHeaders as any,
        status: CarrierWebhookStatus.RECEIVED,
      },
    });

    // 6. Enfileirar no BullMQ real sem fallback de processamento direto em produção
    const isProduction = process.env.NODE_ENV === 'production';

    if (this.webhookQueue) {
      try {
        await Promise.race([
          this.webhookQueue.add(
            'process-webhook',
            { eventId: event.id },
            {
              jobId: `webhook-${event.id}`,
              attempts: 4,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: true,
            },
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('BullMQ timeout')), 1000)),
        ]);
      } catch (queueErr: any) {
        this.logger.error(
          `Erro/Timeout ao enfileirar job BullMQ para o evento ${event.id}: ${queueErr.message}. Mantido status RECEIVED para recovery posterior.`,
        );
        if (!isProduction) {
          this.processWebhookEvent(event.id).catch((err) =>
            this.logger.error(`Falha no processador de fallback dev/test do webhook ${event.id}: ${err.message}`),
          );
        }
      }
    } else {
      if (!isProduction) {
        // Em dev/test sem Redis, executa assincronamente como fallback
        this.processWebhookEvent(event.id).catch((err) =>
          this.logger.error(`Falha no processador de fallback dev/test do webhook ${event.id}: ${err.message}`),
        );
      } else {
        this.logger.warn(`Redis/BullMQ indisponível em produção. Mantido evento ${event.id} em RECEIVED para o recovery job.`);
      }
    }

    return { accepted: true, duplicate: false, eventId: event.id };
  }

  /**
   * Processador do evento de webhook.
   */
  async processWebhookEvent(eventId: string) {
    const event = await this.prisma.carrierWebhookEvent.findUnique({
      where: { id: eventId },
      include: { carrier: { include: { accounts: true } } },
    });

    if (!event || event.status === CarrierWebhookStatus.PROCESSED) {
      return;
    }

    // Marca o evento como PROCESSING atomicamente para impedir dois workers simultâneos
    const updated = await this.prisma.carrierWebhookEvent.updateMany({
      where: {
        id: eventId,
        status: { in: [CarrierWebhookStatus.RECEIVED, CarrierWebhookStatus.FAILED, CarrierWebhookStatus.DEAD_LETTER] },
      },
      data: {
        status: CarrierWebhookStatus.PROCESSING,
        attempts: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      return; // Outro worker/operador assumiu o evento
    }

    return this.processAssumedEvent(event);
  }

  /**
   * Processa um evento que já teve seu status alterado para PROCESSING por uma trava atômica.
   */
  private async processAssumedEvent(event: any) {
    try {
      const activeAccount = event.carrier.accounts?.find(
        (acc: any) => acc.status === 'ACTIVE' || acc.status === CarrierStatus.ACTIVE,
      );
      const providerType = activeAccount?.providerType || event.carrier.providerType || event.carrier.code;
      const provider = this.providerFactory.getProvider(providerType);

      const parsedEvents = await provider.processWebhook(event.payloadJson);

      for (const item of parsedEvents) {
        if (!item.trackingNumber) continue;

        const tracking = await this.prisma.tracking.findUnique({
          where: { trackingNumber: item.trackingNumber },
        });

        if (tracking) {
          const status = (TrackingStatus as any)[item.status] || TrackingStatus.IN_TRANSIT;
          await this.stateMachine.processEvent({
            trackingId: tracking.id,
            eventCode: item.eventCode || 'WEBHOOK_EVENT',
            status,
            title: item.title || 'Atualização via Webhook',
            description: item.description,
            source: undefined,
            eventAt: item.eventAt || new Date(),
            carrierEventId: event.externalEventId || undefined,
          });
        }
      }

      await this.prisma.carrierWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: CarrierWebhookStatus.PROCESSED,
          processedAt: new Date(),
          errorMessage: null,
        },
      });
    } catch (error: any) {
      const currentAttempts = (event.attempts || 0) + 1;
      const isDeadLetter = currentAttempts >= 4;
      await this.prisma.carrierWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: isDeadLetter ? CarrierWebhookStatus.DEAD_LETTER : CarrierWebhookStatus.FAILED,
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }

  /**
   * Serviço de recuperação de webhooks no status RECEIVED com controle de retryCount, maxRetries e nextRetryAt.
   */
  async recoverReceivedEvents(limit = 50) {
    const now = new Date();
    const candidates = await this.prisma.carrierWebhookEvent.findMany({
      where: {
        status: CarrierWebhookStatus.RECEIVED,
        retryCount: { lt: 5 },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      take: limit,
    });

    let reenqueuedCount = 0;
    for (const event of candidates) {
      const nextRetryCount = event.retryCount + 1;
      const backoffMinutes = Math.pow(2, nextRetryCount);
      const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      // Trava atômica incrementando retryCount
      const updated = await this.prisma.carrierWebhookEvent.updateMany({
        where: { id: event.id, status: CarrierWebhookStatus.RECEIVED, retryCount: event.retryCount },
        data: {
          retryCount: nextRetryCount,
          nextRetryAt,
        },
      });

      if (updated.count === 0) continue;

      if (nextRetryCount >= event.maxRetries) {
        await this.prisma.carrierWebhookEvent.update({
          where: { id: event.id },
          data: {
            status: CarrierWebhookStatus.FAILED,
            errorMessage: 'Excedido limite máximo de tentativas de recuperação de webhook (5 tentativas).',
          },
        });
        continue;
      }

      if (this.webhookQueue) {
        try {
          await this.webhookQueue.add(
            'process-webhook',
            { eventId: event.id },
            {
              jobId: `recovery-webhook-${event.id}-${nextRetryCount}`,
              attempts: 2,
              backoff: { type: 'exponential', delay: 1000 },
            },
          );
          reenqueuedCount++;
        } catch (err: any) {
          this.logger.error(`Falha ao reenfileirar evento ${event.id} no recovery: ${err.message}`);
        }
      } else if (process.env.NODE_ENV !== 'production') {
        this.processWebhookEvent(event.id).catch((err) =>
          this.logger.error(`Falha no recovery síncrono dev/test para webhook ${event.id}: ${err.message}`),
        );
        reenqueuedCount++;
      }
    }

    return { reenqueuedCount };
  }

  // Endpoints Administrativos para DLQ (Dead Letter Queue)
  async listDlqEvents(status?: CarrierWebhookStatus) {
    const filterStatus = status || CarrierWebhookStatus.DEAD_LETTER;
    return this.prisma.carrierWebhookEvent.findMany({
      where: { status: filterStatus },
      include: { carrier: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Reprocessamento manual atômico do evento de DLQ com auditoria do operador.
   */
  async reprocessDlqEvent(eventId: string, operatorId: string) {
    const event = await this.prisma.carrierWebhookEvent.findUnique({
      where: { id: eventId },
      include: { carrier: { include: { accounts: true } } },
    });

    if (!event) {
      throw new NotFoundException(`Evento DLQ id '${eventId}' não encontrado.`);
    }

    if (event.status === CarrierWebhookStatus.PROCESSED) {
      throw new ConflictException('Este evento de webhook já foi processado com sucesso anteriormente.');
    }

    // Trava atômica no banco mudando para PROCESSING para evitar dois operadores simultâneos
    const updated = await this.prisma.carrierWebhookEvent.updateMany({
      where: {
        id: eventId,
        status: { in: [CarrierWebhookStatus.FAILED, CarrierWebhookStatus.DEAD_LETTER, CarrierWebhookStatus.RECEIVED] },
      },
      data: {
        status: CarrierWebhookStatus.PROCESSING,
        attempts: 0,
      },
    });

    if (updated.count === 0) {
      throw new ConflictException('O evento está sendo reprocessado por outro operador.');
    }

    // Processa o evento assumido atomicamente
    await this.processAssumedEvent(event);

    const validOperatorId = operatorId && operatorId !== 'anonymous' ? operatorId : null;

    // Auditoria de ação do operador
    await this.prisma.auditLog.create({
      data: {
        userId: validOperatorId,
        action: 'WEBHOOK_DLQ_REPROCESSED',
        entity: 'CarrierWebhookEvent',
        entityId: eventId,
        newValue: {
          carrierId: event.carrierId,
          trackingNumber: event.trackingNumber,
          previousStatus: event.status,
        },
      },
    });

    return { success: true, message: `Evento ${eventId} reprocessado com sucesso.` };
  }

  async cancelDlqEvent(eventId: string, operatorId: string) {
    const event = await this.prisma.carrierWebhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Evento DLQ id '${eventId}' não encontrado.`);
    }

    return this.prisma.carrierWebhookEvent.update({
      where: { id: eventId },
      data: {
        status: CarrierWebhookStatus.FAILED,
        errorMessage: `Cancelado manualmente pelo operador id ${operatorId}`,
      },
    });
  }
}
