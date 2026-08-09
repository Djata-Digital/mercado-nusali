import { CheckoutSessionStatus, StockReservationStatus } from '@prisma/client';

import { CheckoutExpirationService } from './checkout-expiration.service';

describe('CheckoutExpirationService', () => {
  const tx: any = {
    checkoutSession: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const prisma: any = {
    checkoutSession: { findMany: jest.fn() },
  };

  const transactionService: any = {
    run: jest.fn((cb: any) => cb(tx)),
  };

  const events: any = {
    recordCheckoutExpired: jest.fn(),
  };

  const reservations: any = {
    expireSingleReservationInTransaction: jest.fn(),
  };

  let service: CheckoutExpirationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckoutExpirationService(
      prisma,
      transactionService,
      events,
      reservations,
    );
  });

  it('deve expirar uma sessão CREATED vencida e gravar Outbox no mesmo tx', async () => {
    tx.checkoutSession.findUnique.mockResolvedValue({
      id: 'checkout-1',
      userId: 'user-1',
      cartId: 'cart-1',
      status: CheckoutSessionStatus.CREATED,
      expiresAt: new Date(Date.now() - 1000),
      orderGroups: [],
    });
    tx.checkoutSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.expireSession('checkout-1')).resolves.toBe(true);
    expect(tx.checkoutSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: CheckoutSessionStatus.CREATED }),
        data: { status: CheckoutSessionStatus.EXPIRED },
      }),
    );
    expect(events.recordCheckoutExpired).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ checkoutSessionId: 'checkout-1' }),
    );
    expect(reservations.expireSingleReservationInTransaction).not.toHaveBeenCalled();
  });

  it('deve ser idempotente para sessão já EXPIRED', async () => {
    tx.checkoutSession.findUnique.mockResolvedValue({
      id: 'checkout-1',
      status: CheckoutSessionStatus.EXPIRED,
      orderGroups: [],
    });

    await expect(service.expireSession('checkout-1')).resolves.toBe(false);
    expect(tx.checkoutSession.updateMany).not.toHaveBeenCalled();
    expect(events.recordCheckoutExpired).not.toHaveBeenCalled();
  });

  it('não deve expirar CREATED ainda válida', async () => {
    tx.checkoutSession.findUnique.mockResolvedValue({
      id: 'checkout-1',
      status: CheckoutSessionStatus.CREATED,
      expiresAt: new Date(Date.now() + 60_000),
      orderGroups: [],
    });

    await expect(service.expireSession('checkout-1')).resolves.toBe(false);
    expect(tx.checkoutSession.updateMany).not.toHaveBeenCalled();
  });

  it('deve expirar CONFIRMED e liberar reserva vencida usando o mesmo TransactionClient', async () => {
    tx.checkoutSession.findUnique.mockResolvedValue({
      id: 'checkout-1',
      userId: 'user-1',
      cartId: 'cart-1',
      status: CheckoutSessionStatus.CONFIRMED,
      expiresAt: new Date(Date.now() - 1000),
      orderGroups: [
        {
          stockReservations: [
            {
              id: 'reservation-1',
              status: StockReservationStatus.ACTIVE,
              expiresAt: new Date(Date.now() - 1000),
            },
          ],
        },
      ],
    });
    tx.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    reservations.expireSingleReservationInTransaction.mockResolvedValue(true);

    await expect(service.expireSession('checkout-1')).resolves.toBe(true);
    expect(reservations.expireSingleReservationInTransaction).toHaveBeenCalledWith(
      tx,
      'reservation-1',
    );
    expect(events.recordCheckoutExpired).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ checkoutSessionId: 'checkout-1' }),
    );
  });

  it('deve propagar falha da liberação para permitir rollback integral', async () => {
    tx.checkoutSession.findUnique.mockResolvedValue({
      id: 'checkout-1',
      userId: 'user-1',
      cartId: 'cart-1',
      status: CheckoutSessionStatus.CONFIRMED,
      orderGroups: [
        {
          stockReservations: [
            { id: 'reservation-1', expiresAt: new Date(Date.now() - 1000) },
          ],
        },
      ],
    });
    tx.checkoutSession.updateMany.mockResolvedValue({ count: 1 });
    reservations.expireSingleReservationInTransaction.mockRejectedValue(
      new Error('inventory failure'),
    );

    await expect(service.expireSession('checkout-1')).rejects.toThrow(
      'inventory failure',
    );
    expect(events.recordCheckoutExpired).not.toHaveBeenCalled();
  });

  it('deve retornar false quando outro worker já reivindicou a sessão', async () => {
    tx.checkoutSession.findUnique.mockResolvedValue({
      id: 'checkout-1',
      userId: 'user-1',
      cartId: 'cart-1',
      status: CheckoutSessionStatus.CREATED,
      expiresAt: new Date(Date.now() - 1000),
      orderGroups: [],
    });
    tx.checkoutSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.expireSession('checkout-1')).resolves.toBe(false);
    expect(events.recordCheckoutExpired).not.toHaveBeenCalled();
  });

  it('deve processar em lote somente sessões realmente reivindicadas', async () => {
    prisma.checkoutSession.findMany.mockResolvedValue([
      { id: 'checkout-1' },
      { id: 'checkout-2' },
      { id: 'checkout-3' },
    ]);
    const spy = jest
      .spyOn(service, 'expireSession')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(service.processExpiredSessions(25)).resolves.toBe(2);
    expect(prisma.checkoutSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
