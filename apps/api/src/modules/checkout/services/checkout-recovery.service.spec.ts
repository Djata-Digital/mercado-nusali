import { CheckoutSessionStatus, OrderGroupStatus, Prisma, StockReservationStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { StockReservationsService } from '../../stock-reservations/stock-reservations.service';
import { CheckoutEventsService } from './checkout-events.service';
import { CheckoutExpirationService } from './checkout-expiration.service';
import { CheckoutRecoveryService } from './checkout-recovery.service';
import { CheckoutTransactionService } from './checkout-transaction.service';

describe('CheckoutRecoveryService', () => {
  const tx = {
    outboxEvent: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    },
  } as unknown as Prisma.TransactionClient;

  const prisma = {
    stockReservation: { findMany: jest.fn() },
    checkoutSession: { findMany: jest.fn() },
    orderGroup: { findMany: jest.fn() },
  } as unknown as PrismaService;

  const expirationService = {
    processExpiredSessions: jest.fn(),
  } as unknown as CheckoutExpirationService;

  const stockReservationsService = {
    expireSingleReservationInTransaction: jest.fn(),
  } as unknown as StockReservationsService;

  const transactionService = {
    run: jest.fn((operation: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      operation(tx),
    ),
  } as unknown as CheckoutTransactionService;

  const eventsService = {
    recordCheckoutExpired: jest.fn(),
    recordCheckoutRecovered: jest.fn(),
    recordCheckoutRecoveryRequired: jest.fn(),
  } as unknown as CheckoutEventsService;

  const service = new CheckoutRecoveryService(
    prisma,
    expirationService,
    stockReservationsService,
    transactionService,
    eventsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (expirationService.processExpiredSessions as jest.Mock).mockResolvedValue(0);
    (prisma.stockReservation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.checkoutSession.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.orderGroup.findMany as jest.Mock).mockResolvedValue([]);
    (tx.outboxEvent.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it('deve reutilizar o fluxo normal para sessões vencidas', async () => {
    (expirationService.processExpiredSessions as jest.Mock).mockResolvedValue(3);

    const result = await service.recover(50);

    expect(expirationService.processExpiredSessions).toHaveBeenCalledWith(50);
    expect(result.expiredSessions).toBe(3);
  });

  it('deve liberar reserva vencida órfã quando o checkout já é terminal', async () => {
    (prisma.stockReservation.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'reservation-1',
        orderGroup: {
          checkoutSession: {
            id: 'checkout-1',
            userId: 'user-1',
            cartId: 'cart-1',
          },
        },
      },
    ]);
    (
      stockReservationsService.expireSingleReservationInTransaction as jest.Mock
    ).mockResolvedValue(true);

    const result = await service.recover();

    expect(prisma.stockReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: StockReservationStatus.ACTIVE,
          orderGroup: expect.objectContaining({
            checkoutSession: expect.objectContaining({
              status: {
                in: [CheckoutSessionStatus.EXPIRED, CheckoutSessionStatus.CANCELLED],
              },
            }),
          }),
        }),
      }),
    );
    expect(
      stockReservationsService.expireSingleReservationInTransaction,
    ).toHaveBeenCalledWith(tx, 'reservation-1');
    expect(eventsService.recordCheckoutRecovered).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        checkoutSessionId: 'checkout-1',
        action: 'RELEASED_ORPHAN_EXPIRED_RESERVATION',
      }),
    );
    expect(result.releasedOrphanReservations).toBe(1);
  });

  it('não deve contar reserva quando outro worker já a processou', async () => {
    (prisma.stockReservation.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'reservation-1',
        orderGroup: {
          checkoutSession: {
            id: 'checkout-1',
            userId: 'user-1',
            cartId: 'cart-1',
          },
        },
      },
    ]);
    (
      stockReservationsService.expireSingleReservationInTransaction as jest.Mock
    ).mockResolvedValue(false);

    const result = await service.recover();

    expect(eventsService.recordCheckoutRecovered).not.toHaveBeenCalled();
    expect(result.releasedOrphanReservations).toBe(0);
  });

  it('deve restaurar checkout.expired ausente e auditar a recuperação', async () => {
    (prisma.checkoutSession.findMany as jest.Mock).mockResolvedValue([
      { id: 'checkout-1', userId: 'user-1', cartId: 'cart-1' },
    ]);
    (tx.outboxEvent.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await service.recover();

    expect(eventsService.recordCheckoutExpired).toHaveBeenCalledWith(tx, {
      userId: 'user-1',
      checkoutSessionId: 'checkout-1',
      cartId: 'cart-1',
    });
    expect(eventsService.recordCheckoutRecovered).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'RESTORED_MISSING_CHECKOUT_EXPIRED_EVENT',
      }),
    );
    expect(result.restoredExpiredEvents).toBe(1);
  });

  it('deve ser idempotente quando checkout.expired já existe', async () => {
    (prisma.checkoutSession.findMany as jest.Mock).mockResolvedValue([
      { id: 'checkout-1', userId: 'user-1', cartId: 'cart-1' },
    ]);
    (tx.outboxEvent.findFirst as jest.Mock).mockResolvedValue({ id: 'evt-old' });

    const result = await service.recover();

    expect(eventsService.recordCheckoutExpired).not.toHaveBeenCalled();
    expect(result.restoredExpiredEvents).toBe(0);
  });

  it('deve sinalizar checkout CONFIRMED sem OrderGroup em vez de adivinhar correção', async () => {
    (prisma.checkoutSession.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // sessões EXPIRED para restauração da Outbox
      .mockResolvedValueOnce([
        { id: 'checkout-1', userId: 'user-1', cartId: 'cart-1' },
      ]);

    const result = await service.recover();

    expect(eventsService.recordCheckoutRecoveryRequired).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        checkoutSessionId: 'checkout-1',
        reason: 'CONFIRMED_WITHOUT_ORDER_GROUP',
      }),
    );
    expect(result.flaggedInconsistencies).toBe(1);
  });

  it('deve sinalizar OrderGroup PENDING_PAYMENT sem reserva', async () => {
    (prisma.orderGroup.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'group-1',
        checkoutSession: {
          id: 'checkout-1',
          userId: 'user-1',
          cartId: 'cart-1',
        },
      },
    ]);

    const result = await service.recover();

    expect(prisma.orderGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OrderGroupStatus.PENDING_PAYMENT,
          stockReservations: { none: {} },
        }),
      }),
    );
    expect(eventsService.recordCheckoutRecoveryRequired).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        reason: 'PENDING_ORDER_GROUP_WITHOUT_STOCK_RESERVATION',
        referenceId: 'group-1',
      }),
    );
    expect(result.flaggedInconsistencies).toBe(1);
  });

  it('não deve duplicar recovery_required para o mesmo motivo', async () => {
    (prisma.checkoutSession.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'checkout-1', userId: 'user-1', cartId: 'cart-1' },
      ]);
    (tx.outboxEvent.findFirst as jest.Mock).mockResolvedValue({ id: 'evt-existing' });

    const result = await service.recover();

    expect(eventsService.recordCheckoutRecoveryRequired).not.toHaveBeenCalled();
    expect(result.flaggedInconsistencies).toBe(0);
  });

  it('deve normalizar o tamanho do lote para no máximo 500', async () => {
    await service.recover(9999);

    expect(expirationService.processExpiredSessions).toHaveBeenCalledWith(500);
    expect(prisma.stockReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });
});
