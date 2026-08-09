import { Injectable } from '@nestjs/common';
import { EscrowStatus, OutboxStatus, Prisma } from '@prisma/client';

import { sanitizeForJson } from '../../../common/utils/decimal.util';

/**
 * Persistência transacional dos eventos de domínio do Escrow.
 *
 * Não publica EventEmitter dentro da transação. O worker geral da Outbox é
 * responsável pela entrega assíncrona somente após o commit.
 */
@Injectable()
export class EscrowEventsService {
  recordHeld(
    tx: Prisma.TransactionClient,
    escrow: {
      id: string;
      orderId: string;
      orderGroupId: string;
      sellerId: string;
      buyerId: string;
      totalAmount: Prisma.Decimal;
      status: EscrowStatus;
    },
  ) {
    return this.record(tx, escrow.id, 'escrow.held', {
      escrowAccountId: escrow.id,
      orderId: escrow.orderId,
      orderGroupId: escrow.orderGroupId,
      sellerId: escrow.sellerId,
      buyerId: escrow.buyerId,
      amount: escrow.totalAmount,
      status: escrow.status,
    });
  }

  recordPartiallyReleased(
    tx: Prisma.TransactionClient,
    escrowAccountId: string,
    payload: Record<string, unknown>,
  ) {
    return this.record(tx, escrowAccountId, 'escrow.partially_released', payload);
  }

  recordReleased(
    tx: Prisma.TransactionClient,
    escrowAccountId: string,
    payload: Record<string, unknown>,
  ) {
    return this.record(tx, escrowAccountId, 'escrow.released', payload);
  }

  recordRefunded(
    tx: Prisma.TransactionClient,
    escrowAccountId: string,
    payload: Record<string, unknown>,
  ) {
    return this.record(tx, escrowAccountId, 'escrow.refunded', payload);
  }

  recordCancelled(
    tx: Prisma.TransactionClient,
    escrowAccountId: string,
    payload: Record<string, unknown>,
  ) {
    return this.record(tx, escrowAccountId, 'escrow.cancelled', payload);
  }

  recordDisputeOpened(
    tx: Prisma.TransactionClient,
    escrowAccountId: string,
    payload: Record<string, unknown>,
  ) {
    return this.record(tx, escrowAccountId, 'escrow.dispute_opened', payload);
  }

  recordDisputeResolved(
    tx: Prisma.TransactionClient,
    escrowAccountId: string,
    payload: Record<string, unknown>,
  ) {
    return this.record(tx, escrowAccountId, 'escrow.dispute_resolved', payload);
  }

  private record(
    tx: Prisma.TransactionClient,
    escrowAccountId: string,
    eventType: string,
    payload: unknown,
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: 'EscrowAccount',
        aggregateId: escrowAccountId,
        eventType,
        payloadJson: sanitizeForJson(payload),
        status: OutboxStatus.PENDING,
      },
    });
  }
}
