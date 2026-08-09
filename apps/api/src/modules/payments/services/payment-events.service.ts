import { Injectable } from '@nestjs/common';
import { OutboxStatus, PaymentStatus, Prisma } from '@prisma/client';

import { sanitizeForJson } from '../../../common/utils/decimal.util';

/**
 * PaymentEventsService
 *
 * Centraliza os eventos de domínio do agregado Payment.
 *
 * Importante: eventos críticos são somente persistidos na Outbox dentro da
 * mesma transação. A publicação assíncrona é responsabilidade do worker geral
 * da Outbox após o commit.
 */
@Injectable()
export class PaymentEventsService {
  async recordCreated(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      buyerId: string;
      orderGroupId: string;
      amount: Prisma.Decimal;
      status: PaymentStatus;
    },
  ) {
    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        eventType: 'PAYMENT_CREATED',
        previousStatus: null,
        newStatus: payment.status,
      },
    });

    return this.recordOutbox(tx, payment.id, 'payment.created', {
      paymentId: payment.id,
      buyerId: payment.buyerId,
      orderGroupId: payment.orderGroupId,
      amount: payment.amount,
      status: payment.status,
    });
  }

  async recordStatusEvent(
    tx: Prisma.TransactionClient,
    paymentId: string,
    status: PaymentStatus,
    payload: Record<string, unknown> = {},
  ) {
    const eventType = this.toOutboxEventType(status);
    if (!eventType) return null;

    return this.recordOutbox(tx, paymentId, eventType, {
      paymentId,
      status,
      ...payload,
    });
  }

  private toOutboxEventType(status: PaymentStatus): string | null {
    const eventTypes: Partial<Record<PaymentStatus, string>> = {
      [PaymentStatus.PENDING]: 'payment.pending',
      [PaymentStatus.PROCESSING]: 'payment.processing',
      [PaymentStatus.AUTHORIZED]: 'payment.authorized',
      [PaymentStatus.CAPTURED]: 'payment.captured',
      [PaymentStatus.FAILED]: 'payment.failed',
      [PaymentStatus.CANCELLED]: 'payment.cancelled',
      [PaymentStatus.EXPIRED]: 'payment.expired',
      [PaymentStatus.PARTIALLY_REFUNDED]: 'payment.partially_refunded',
      [PaymentStatus.REFUNDED]: 'payment.refunded',
    };

    return eventTypes[status] ?? null;
  }

  private recordOutbox(
    tx: Prisma.TransactionClient,
    paymentId: string,
    eventType: string,
    payload: unknown,
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: 'Payment',
        aggregateId: paymentId,
        eventType,
        payloadJson: sanitizeForJson(payload),
        status: OutboxStatus.PENDING,
      },
    });
  }
}
