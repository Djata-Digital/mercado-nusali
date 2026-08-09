import { Prisma } from '@prisma/client';

import { CheckoutEventsService } from './checkout-events.service';

describe('CheckoutEventsService', () => {
  const tx = {
    outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'evt-1' }) },
  } as unknown as Prisma.TransactionClient;

  const service = new CheckoutEventsService();

  beforeEach(() => jest.clearAllMocks());

  it('deve registrar checkout.started com payload padronizado', async () => {
    const expiresAt = new Date('2026-08-07T12:00:00.000Z');

    await service.recordCheckoutStarted(tx, {
      userId: 'user-1',
      cartId: 'cart-1',
      checkoutSessionId: 'session-1',
      expiresAt,
    });

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'checkout.started',
        aggregateId: 'session-1',
        payloadJson: expect.objectContaining({
          eventVersion: 1,
          expiresAt: expiresAt.toISOString(),
        }),
      }),
    });
  });

  it('deve serializar total do pedido como string', async () => {
    await service.recordOrderCreated(tx, {
      userId: 'user-1',
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      total: new Prisma.Decimal('125.50'),
    });

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payloadJson: expect.objectContaining({ total: '125.5' }),
      }),
    });
  });


  it('deve registrar checkout.recovered com ação auditável', async () => {
    await service.recordCheckoutRecovered(tx, {
      userId: 'user-1',
      checkoutSessionId: 'session-1',
      cartId: 'cart-1',
      action: 'RESTORED_MISSING_CHECKOUT_EXPIRED_EVENT',
    });

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'checkout.recovered',
        aggregateId: 'session-1',
        payloadJson: expect.objectContaining({
          eventVersion: 1,
          action: 'RESTORED_MISSING_CHECKOUT_EXPIRED_EVENT',
        }),
      }),
    });
  });

  it('deve registrar checkout.recovery_required sem alterar o agregado', async () => {
    await service.recordCheckoutRecoveryRequired(tx, {
      userId: 'user-1',
      checkoutSessionId: 'session-1',
      cartId: 'cart-1',
      reason: 'CONFIRMED_WITHOUT_ORDER_GROUP',
    });

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'checkout.recovery_required',
        aggregateId: 'session-1',
        payloadJson: expect.objectContaining({
          reason: 'CONFIRMED_WITHOUT_ORDER_GROUP',
        }),
      }),
    });
  });
});
