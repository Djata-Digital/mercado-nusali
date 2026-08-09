import { Injectable } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';

@Injectable()
export class PayoutEventsService {
  async enqueue(
    tx: Prisma.TransactionClient,
    payoutId: string,
    eventType: string,
    payload: Prisma.InputJsonValue,
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: 'Payout',
        aggregateId: payoutId,
        eventType,
        payloadJson: payload,
        status: OutboxStatus.PENDING,
      },
    });
  }
}
