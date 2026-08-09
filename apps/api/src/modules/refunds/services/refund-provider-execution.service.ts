import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';

import { EscrowService } from '../../escrow/escrow.service';
import { PaymentProviderFactory } from '../../payments/providers/payment-provider.factory';
import {
  PaymentGatewayErrorClassifierService,
  PaymentGatewayException,
} from '../../payments/services/payment-gateway-error-classifier.service';
import { PaymentProviderTimeoutService } from '../../payments/services/payment-provider-timeout.service';
import { RefundTransactionService } from './refund-transaction.service';

type RefundWithPayment = Prisma.RefundGetPayload<{ include: { payment: true } }>;

@Injectable()
export class RefundProviderExecutionService {
  constructor(
    private readonly refundTransaction: RefundTransactionService,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly providerTimeout: PaymentProviderTimeoutService,
    private readonly errorClassifier: PaymentGatewayErrorClassifierService,
    private readonly escrowService: EscrowService,
  ) {}

  getIdempotencyKey(refundId: string): string {
    return `refund:${refundId}`;
  }

  async execute(refundId: string) {
    const claimed = await this.claimPending(refundId);
    if (claimed.status === RefundStatus.COMPLETED) return claimed;
    return this.invokeProviderAndFinalize(claimed);
  }

  /**
   * Retry explícito somente para PROCESSING antigo/ambíguo.
   * O updatedAt funciona como lease sem exigir migration nesta fase.
   */
  async retry(refundId: string) {
    const claimed = await this.claimStaleProcessing(refundId);
    if (claimed.status === RefundStatus.COMPLETED) return claimed;
    return this.invokeProviderAndFinalize(claimed);
  }

  async reconcile(refundId: string) {
    return this.retry(refundId);
  }

  private async claimPending(refundId: string): Promise<RefundWithPayment> {
    return this.refundTransaction.run(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id: refundId },
        include: { payment: true },
      });
      if (!refund) throw new NotFoundException('Registro de reembolso não encontrado.');
      if (refund.status === RefundStatus.COMPLETED) return refund;
      if (refund.status === RefundStatus.PROCESSING) {
        throw new ConflictException({
          statusCode: 409,
          message: 'O reembolso já está sendo processado.',
          errorCode: 'REFUND_ALREADY_PROCESSING',
        });
      }
      if (refund.status !== RefundStatus.PENDING) {
        throw new ConflictException('O reembolso não pode ser executado neste estado.');
      }

      await this.assertPaymentCapacity(tx, refund);

      const claimed = await tx.refund.updateMany({
        where: { id: refund.id, status: RefundStatus.PENDING },
        data: { status: RefundStatus.PROCESSING },
      });
      if (claimed.count !== 1) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Outro worker já reivindicou este reembolso.',
          errorCode: 'REFUND_CLAIM_CONFLICT',
        });
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Refund',
          aggregateId: refund.id,
          eventType: 'refund.processing',
          payloadJson: {
            refundId: refund.id,
            paymentId: refund.paymentId,
            amount: refund.amount.toString(),
            idempotencyKey: this.getIdempotencyKey(refund.id),
          },
        },
      });

      return tx.refund.findUniqueOrThrow({
        where: { id: refund.id },
        include: { payment: true },
      });
    });
  }

  private async claimStaleProcessing(refundId: string): Promise<RefundWithPayment> {
    return this.refundTransaction.run(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id: refundId },
        include: { payment: true },
      });
      if (!refund) throw new NotFoundException('Registro de reembolso não encontrado.');
      if (refund.status === RefundStatus.COMPLETED) return refund;
      if (refund.status !== RefundStatus.PROCESSING) {
        throw new ConflictException('Somente reembolsos em PROCESSING podem ser reconciliados.');
      }

      const staleMs = this.getRetryStaleMs();
      if (Date.now() - refund.updatedAt.getTime() < staleMs) {
        throw new ConflictException({
          statusCode: 409,
          message: 'O reembolso ainda possui uma execução ativa.',
          errorCode: 'REFUND_EXECUTION_LEASE_ACTIVE',
        });
      }

      const leaseAt = new Date();
      const claimed = await tx.refund.updateMany({
        where: {
          id: refund.id,
          status: RefundStatus.PROCESSING,
          updatedAt: refund.updatedAt,
        },
        data: { updatedAt: leaseAt },
      });
      if (claimed.count !== 1) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Outro worker iniciou a reconciliação deste reembolso.',
          errorCode: 'REFUND_RETRY_CLAIM_CONFLICT',
        });
      }

      await this.assertPaymentCapacity(tx, refund, true);
      return tx.refund.findUniqueOrThrow({
        where: { id: refund.id },
        include: { payment: true },
      });
    });
  }

/**
   * Sprint 7.4.3: aplica confirmação assíncrona do provider.
   * COMPLETED é idempotente; FAILED nunca pode regredir um refund já concluído.
   */
  async applyProviderWebhookResult(
    refundId: string,
    outcome: 'COMPLETED' | 'FAILED',
    reason = 'Provider confirmou falha do refund.',
  ) {
    const current = await this.refundTransaction.run(async (tx) =>
      tx.refund.findUnique({
        where: { id: refundId },
      }),
    );

    if (!current) {
      throw new NotFoundException('Registro de reembolso não encontrado.');
    }

    if (current.status === RefundStatus.COMPLETED) {
      return current;
    }

    if (outcome === 'COMPLETED') {
      if (current.status !== RefundStatus.PROCESSING) {
        throw new ConflictException({
          statusCode: 409,
          message:
            'Confirmação de refund concluído recebida fora de PROCESSING.',
          errorCode: 'REFUND_WEBHOOK_INVALID_COMPLETION_STATE',
        });
      }

      return this.finalizeCompleted(refundId);
    }

    if (current.status === RefundStatus.FAILED) {
      return current;
    }

    if (current.status !== RefundStatus.PROCESSING) {
      throw new ConflictException({
        statusCode: 409,
        message:
          'Confirmação de falha do refund recebida fora de PROCESSING.',
        errorCode: 'REFUND_WEBHOOK_INVALID_FAILURE_STATE',
      });
    }

    await this.markFailed(refundId, reason);

    return this.refundTransaction.run(async (tx) =>
      tx.refund.findUniqueOrThrow({ where: { id: refundId } }),
    );
  }

  private async invokeProviderAndFinalize(refund: RefundWithPayment) {
    const provider = this.providerFactory.getByType(refund.payment.provider);
    const idempotencyKey = this.getIdempotencyKey(refund.id);

    try {
      const invocation = await this.providerTimeout.invoke(provider, () =>
        provider.refundPayment(
          refund.payment.id,
          refund.payment.providerTransactionId ?? refund.payment.id,
          new Prisma.Decimal(refund.amount),
          { refundId: refund.id, idempotencyKey },
        ),
      );

      const result = invocation.result;
      if (!result.success) {
        await this.markFailed(refund.id, result.errorMessage || 'Provider recusou o reembolso.');
        throw new ConflictException(result.errorMessage || 'Provider recusou o reembolso.');
      }

      return this.finalizeCompleted(refund.id);
    } catch (error: unknown) {
      if (error instanceof ConflictException) throw error;

      const classified = this.errorClassifier.classify(error);
      if (classified.retryable) {
        // Resultado transitório/ambíguo: preserva PROCESSING e a mesma idempotency key.
        await this.recordPendingConfirmation(refund.id, classified);
        throw classified;
      }

      await this.markFailed(refund.id, classified.errorCode);
      throw classified;
    }
  }

  private async finalizeCompleted(refundId: string) {
    return this.refundTransaction.run(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id: refundId },
        include: { payment: true },
      });
      if (!refund) throw new NotFoundException('Registro de reembolso não encontrado.');
      if (refund.status === RefundStatus.COMPLETED) return refund;
      if (refund.status !== RefundStatus.PROCESSING) {
        throw new ConflictException('O reembolso não está mais em processamento.');
      }

      await this.escrowService.refundEscrow(
        refund.orderId,
        refund.amount,
        tx,
        refund.buyerId,
        {
          paymentId: refund.paymentId,
          reason: refund.reason ?? undefined,
          refundId: refund.id,
        },
      );

      const totals = await tx.refund.aggregate({
        where: { paymentId: refund.paymentId, status: RefundStatus.COMPLETED },
        _sum: { amount: true },
      });
      const completedTotal = totals._sum.amount ?? new Prisma.Decimal(0);
      if (completedTotal.gt(refund.payment.amount)) {
        throw new ConflictException({
          statusCode: 409,
          message: 'O total reembolsado excederia o valor capturado.',
          errorCode: 'REFUND_OVER_PAYMENT_AMOUNT',
        });
      }

      const paymentStatus = completedTotal.eq(refund.payment.amount)
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

      await tx.payment.update({
        where: { id: refund.paymentId },
        data: { status: paymentStatus },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Refund',
          aggregateId: refund.id,
          eventType: 'refund.completed',
          payloadJson: {
            refundId: refund.id,
            paymentId: refund.paymentId,
            orderId: refund.orderId,
            amount: refund.amount.toString(),
            idempotencyKey: this.getIdempotencyKey(refund.id),
            paymentStatus,
          },
        },
      });

      return tx.refund.findUniqueOrThrow({ where: { id: refund.id } });
    });
  }

  private async markFailed(refundId: string, reason: string) {
    return this.refundTransaction.run(async (tx) => {
      const changed = await tx.refund.updateMany({
        where: { id: refundId, status: RefundStatus.PROCESSING },
        data: { status: RefundStatus.FAILED, processedAt: new Date() },
      });
      if (changed.count === 0) return;

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Refund',
          aggregateId: refundId,
          eventType: 'refund.failed',
          payloadJson: {
            refundId,
            reason: this.sanitizeReason(reason),
            idempotencyKey: this.getIdempotencyKey(refundId),
          },
        },
      });
    });
  }

  private async recordPendingConfirmation(
    refundId: string,
    error: PaymentGatewayException,
  ) {
    await this.refundTransaction.run(async (tx) => {
      const current = await tx.refund.findUnique({ where: { id: refundId } });
      if (!current || current.status !== RefundStatus.PROCESSING) return;
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Refund',
          aggregateId: refundId,
          eventType: 'refund.pending_confirmation',
          payloadJson: {
            refundId,
            errorCode: error.errorCode,
            retryable: true,
            idempotencyKey: this.getIdempotencyKey(refundId),
          },
        },
      });
    });
  }

  private async assertPaymentCapacity(
    tx: Prisma.TransactionClient,
    refund: RefundWithPayment,
    includeCurrentProcessing = false,
  ) {
    // Escreve no Payment para serializar claims concorrentes sobre o mesmo agregado.
    await tx.payment.update({
      where: { id: refund.paymentId },
      data: { updatedAt: new Date() },
    });

    const active = await tx.refund.aggregate({
      where: {
        paymentId: refund.paymentId,
        ...(includeCurrentProcessing ? { id: { not: refund.id } } : {}),
        status: { in: [RefundStatus.PROCESSING, RefundStatus.COMPLETED] },
      },
      _sum: { amount: true },
    });
    const committed = active._sum.amount ?? new Prisma.Decimal(0);
    if (committed.add(refund.amount).gt(refund.payment.amount)) {
      throw new ConflictException({
        statusCode: 409,
        message: 'O reembolso excede o saldo restante do pagamento.',
        errorCode: 'REFUND_OVER_PAYMENT_AMOUNT',
      });
    }
  }

  private getRetryStaleMs() {
    const parsed = Number(process.env.REFUND_PROCESSING_STALE_MS ?? '60000');
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 60_000;
  }

  private sanitizeReason(reason: string) {
    return String(reason).replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [REDACTED]').slice(0, 160);
  }
}
