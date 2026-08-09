import { Prisma } from '@prisma/client';

export async function recordOutboxEvent(
  tx: Prisma.TransactionClient,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, any>,
) {
  return tx.outboxEvent.create({
    data: {
      aggregateType,
      aggregateId,
      eventType,
      payloadJson: payload,
      status: 'PENDING',
    },
  });
}
