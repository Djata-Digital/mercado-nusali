import { OutboxStatus, PaymentStatus, Prisma } from '@prisma/client';

import { PaymentEventsService } from './payment-events.service';

describe('PaymentEventsService', () => {
  const service = new PaymentEventsService();

  it('deve gravar PaymentEvent e payment.created na mesma transação', async () => {
    const tx: any = {
      paymentEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
      outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
    };

    await service.recordCreated(tx, {
      id: 'payment-1',
      buyerId: 'buyer-1',
      orderGroupId: 'group-1',
      amount: new Prisma.Decimal(100),
      status: PaymentStatus.PENDING,
    });

    expect(tx.paymentEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aggregateType: 'Payment',
          aggregateId: 'payment-1',
          eventType: 'payment.created',
          status: OutboxStatus.PENDING,
        }),
      }),
    );
  });

  it('deve mapear CAPTURED para payment.captured', async () => {
    const tx: any = {
      outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
    };

    await service.recordStatusEvent(
      tx,
      'payment-1',
      PaymentStatus.CAPTURED,
      { orderGroupId: 'group-1' },
    );

    expect(tx.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'payment.captured' }),
      }),
    );
  });

  it('não deve criar evento de status para CREATED além de payment.created', async () => {
    const tx: any = { outboxEvent: { create: jest.fn() } };

    const result = await service.recordStatusEvent(
      tx,
      'payment-1',
      PaymentStatus.CREATED,
    );

    expect(result).toBeNull();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
