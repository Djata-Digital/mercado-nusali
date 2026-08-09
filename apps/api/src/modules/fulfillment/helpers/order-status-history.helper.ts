import { Prisma, OrderStatus } from '@prisma/client';

export async function changeOrderStatusInTransaction(
  tx: Prisma.TransactionClient,
  orderId: string,
  newStatus: OrderStatus,
  reason?: string,
  changedById?: string,
  metadata?: Record<string, any>,
) {
  const currentOrder = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });

  if (!currentOrder) return;

  const previousStatus = currentOrder.status;

  if (previousStatus === newStatus) return;

  await tx.order.update({
    where: { id: orderId },
    data: { status: newStatus },
  });

  await tx.orderStatusHistory.create({
    data: {
      orderId,
      previousStatus,
      newStatus,
      reason: reason || null,
      changedById: changedById || null,
      metadataJson: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}
