import { EscrowStatus, OutboxStatus, Prisma } from '@prisma/client';

import { EscrowEventsService } from './escrow-events.service';

describe('EscrowEventsService', () => {
  let service: EscrowEventsService;
  let tx: { outboxEvent: { create: jest.Mock } };

  beforeEach(() => {
    service = new EscrowEventsService();
    tx = { outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) } };
  });

  it('deve gravar escrow.held como PENDING na mesma transação', async () => {
    await service.recordHeld(tx as unknown as Prisma.TransactionClient, {
      id: 'escrow-1',
      orderId: 'order-1',
      orderGroupId: 'group-1',
      sellerId: 'seller-1',
      buyerId: 'buyer-1',
      totalAmount: new Prisma.Decimal(100),
      status: EscrowStatus.HELD,
    });

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: 'EscrowAccount',
        aggregateId: 'escrow-1',
        eventType: 'escrow.held',
        status: OutboxStatus.PENDING,
      }),
    });
  });

  it('deve gravar evento de liberação parcial', async () => {
    await service.recordPartiallyReleased(
      tx as unknown as Prisma.TransactionClient,
      'escrow-1',
      { amount: new Prisma.Decimal(25) },
    );

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'escrow.partially_released' }),
    });
  });

  it('deve gravar escrow.released', async () => {
    await service.recordReleased(
      tx as unknown as Prisma.TransactionClient,
      'escrow-1',
      { amount: 100 },
    );

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'escrow.released' }),
    });
  });
});
