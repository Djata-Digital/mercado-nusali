import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentProvider,
  Prisma,
  RefundStatus,
  WebhookStatus,
} from '@prisma/client';

import { PaymentProviderFactory } from '../../payments/providers/payment-provider.factory';
import { PrismaService } from '../../prisma/prisma.service';
import { RefundProviderExecutionService } from './refund-provider-execution.service';

type NormalizedRefundWebhookStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'PROCESSING'
  | 'UNKNOWN';

@Injectable()
export class RefundProviderWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly execution: RefundProviderExecutionService,
  ) {}

  async process(
    providerRaw: string,
    eventId: string,
    eventType: string,
    headers: Record<string, unknown>,
    payload: Record<string, unknown>,
    signature?: string,
  ) {
    const provider = this.parseProvider(providerRaw);
    const adapter = this.providerFactory.getByType(provider);

    const valid = await adapter.validateWebhook(headers, payload, signature);
    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Assinatura do webhook de refund inválida.',
        errorCode: 'REFUND_WEBHOOK_INVALID_SIGNATURE',
      });
    }

    let existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });

    if (existing?.status === WebhookStatus.PROCESSED) {
      return {
        success: true,
        alreadyProcessed: true,
        data: existing.resultJson,
      };
    }

    // Sprint 7.4.3.1: RECEIVED funciona como claim do evento.
    // Um segundo worker não pode executar o mesmo efeito financeiro.
    if (existing?.status === WebhookStatus.RECEIVED) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Este webhook de refund já está sendo processado.',
        errorCode: 'REFUND_WEBHOOK_ALREADY_PROCESSING',
      });
    }

    let webhook = existing;

    if (!webhook) {
      try {
        webhook = await this.prisma.webhookEvent.create({
          data: {
            provider,
            eventId,
            eventType,
            headersJson: this.safeJson(headers),
            payloadJson: this.safeJson(payload),
            signature: signature ? '[REDACTED]' : undefined,
            status: WebhookStatus.RECEIVED,
          },
        });
      } catch (error: unknown) {
        // Dois workers podem passar pelo findUnique antes do INSERT.
        // O unique(provider,eventId) é a barreira final no PostgreSQL.
        if ((error as { code?: string } | null)?.code !== 'P2002') {
          throw error;
        }

        existing = await this.prisma.webhookEvent.findUnique({
          where: {
            provider_eventId: {
              provider,
              eventId,
            },
          },
        });

        if (!existing) throw error;

        if (existing.status === WebhookStatus.PROCESSED) {
          return {
            success: true,
            alreadyProcessed: true,
            data: existing.resultJson,
          };
        }

        throw new ConflictException({
          statusCode: 409,
          message: 'Este webhook de refund já está sendo processado.',
          errorCode: 'REFUND_WEBHOOK_ALREADY_PROCESSING',
        });
      }
    }

    try {
      const refundId = this.extractRefundId(payload);
      if (!refundId) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Webhook de refund sem refundId reconhecível.',
          errorCode: 'REFUND_WEBHOOK_REFUND_ID_MISSING',
        });
      }

      const refund = await this.prisma.refund.findUnique({
        where: { id: refundId },
        include: { payment: true },
      });

      if (!refund) {
        throw new NotFoundException('Refund informado pelo webhook não existe.');
      }

      if (refund.payment.provider !== provider) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Provider do webhook não corresponde ao provider do pagamento.',
          errorCode: 'REFUND_WEBHOOK_PROVIDER_MISMATCH',
        });
      }

      const normalizedStatus = this.normalizeStatus(eventType, payload);

      let result: unknown;

      if (normalizedStatus === 'COMPLETED') {
        result = await this.execution.applyProviderWebhookResult(
          refund.id,
          'COMPLETED',
        );
      } else if (normalizedStatus === 'FAILED') {
        result = await this.execution.applyProviderWebhookResult(
          refund.id,
          'FAILED',
          this.extractReason(payload),
        );
      } else {
        // PROCESSING/UNKNOWN não deve regredir nem finalizar o Refund.
        result = {
          refundId: refund.id,
          status: refund.status,
          ignored: true,
          webhookStatus: normalizedStatus,
        };
      }

      const webhookResult = {
        refundId: refund.id,
        normalizedStatus,
        refundStatus:
          typeof result === 'object' &&
          result !== null &&
          'status' in result
            ? String((result as { status?: unknown }).status ?? refund.status)
            : refund.status,
      };

      await this.prisma.webhookEvent.update({
        where: { id: webhook.id },
        data: {
          status: WebhookStatus.PROCESSED,
          processedAt: new Date(),
          resultJson: webhookResult,
        },
      });

      return {
        success: true,
        alreadyProcessed: false,
        data: webhookResult,
      };
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: webhook.id },
        data: {
          status: WebhookStatus.FAILED,
          processedAt: new Date(),
          resultJson: {
            error: this.sanitizeError(error),
          },
        },
      });

      throw error;
    }
  }

  private parseProvider(value: string): PaymentProvider {
    const normalized = String(value ?? '').trim().toUpperCase();

    if (
      !Object.values(PaymentProvider).includes(
        normalized as PaymentProvider,
      )
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Provider de refund inválido: ${value}.`,
        errorCode: 'REFUND_WEBHOOK_PROVIDER_INVALID',
      });
    }

    return normalized as PaymentProvider;
  }

  private extractRefundId(payload: Record<string, unknown>): string | null {
    const direct = payload.refundId;
    if (typeof direct === 'string' && direct.trim()) return direct;

    const data = payload.data;
    if (data && typeof data === 'object') {
      const value = (data as Record<string, unknown>).refundId;
      if (typeof value === 'string' && value.trim()) return value;
    }

    const metadata = payload.metadata;
    if (metadata && typeof metadata === 'object') {
      const value = (metadata as Record<string, unknown>).refundId;
      if (typeof value === 'string' && value.trim()) return value;
    }

    return null;
  }

  private normalizeStatus(
    eventType: string,
    payload: Record<string, unknown>,
  ): NormalizedRefundWebhookStatus {
    const rawPayloadStatus =
      typeof payload.status === 'string' ? payload.status : '';
    const combined = `${eventType} ${rawPayloadStatus}`.toLowerCase();

    if (
      combined.includes('completed') ||
      combined.includes('succeeded') ||
      combined.includes('success') ||
      combined.includes('refunded')
    ) {
      return 'COMPLETED';
    }

    if (
      combined.includes('failed') ||
      combined.includes('rejected') ||
      combined.includes('declined') ||
      combined.includes('cancelled')
    ) {
      return 'FAILED';
    }

    if (
      combined.includes('processing') ||
      combined.includes('pending') ||
      combined.includes('queued')
    ) {
      return 'PROCESSING';
    }

    return 'UNKNOWN';
  }

  private extractReason(payload: Record<string, unknown>) {
    const values = [
      payload.reason,
      payload.error,
      payload.message,
      payload.errorCode,
    ];

    const value = values.find(
      (item) => typeof item === 'string' && item.trim().length > 0,
    );

    return this.sanitizeText(
      typeof value === 'string' ? value : 'Provider informou falha no refund.',
    );
  }

  private sanitizeText(value: string) {
    return String(value)
      .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]')
      .replace(
        /(token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi,
        '$1=[REDACTED]',
      )
      .slice(0, 200);
  }

  private sanitizeError(error: unknown) {
    if (error instanceof Error) return this.sanitizeText(error.message);
    return this.sanitizeText(String(error));
  }

  private safeJson(value: unknown): Prisma.InputJsonValue {
    if (!value || typeof value !== 'object') return {};
    return JSON.parse(
      JSON.stringify(value, (key, item) => {
        if (
          ['authorization', 'token', 'secret', 'password', 'signature'].includes(
            key.toLowerCase(),
          )
        ) {
          return '[REDACTED]';
        }
        return item;
      }),
    );
  }
}
