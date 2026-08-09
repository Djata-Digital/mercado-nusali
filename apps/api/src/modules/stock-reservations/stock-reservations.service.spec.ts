import { ConflictException } from '@nestjs/common';
import { StockReservationsService } from './stock-reservations.service';

describe('StockReservationsService - refatoração Sprint 6.3.1', () => {
  const tx: any = {
    stockReservation: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    inventoryItem: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    inventoryMovement: { create: jest.fn() },
    orderGroup: { updateMany: jest.fn() },
    order: { updateMany: jest.fn() },
    orderStatusHistory: { create: jest.fn() },
    couponRedemption: { updateMany: jest.fn() },
    coupon: { updateMany: jest.fn() },
    outboxEvent: { create: jest.fn() },
  };

  const prisma: any = {
    $transaction: jest.fn((callback) => callback(tx)),
    stockReservation: { findMany: jest.fn() },
  };

  let service: StockReservationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StockReservationsService(prisma);
  });

  function reservationFixture(items: any[] = []) {
    return {
      id: 'reservation-1',
      orderGroupId: 'group-1',
      status: 'EXPIRED',
      items,
      orderGroup: {
        id: 'group-1',
        status: 'PENDING_PAYMENT',
        orders: [],
        couponRedemptions: [],
      },
    };
  }

  it('deve reivindicar ACTIVE -> EXPIRED de forma atômica e idempotente', async () => {
    tx.stockReservation.updateMany.mockResolvedValue({ count: 1 });
    tx.stockReservation.findUnique.mockResolvedValue(reservationFixture());
    tx.orderGroup.updateMany.mockResolvedValue({ count: 1 });
    tx.outboxEvent.create.mockResolvedValue({});

    await expect(service.expireSingleReservation('reservation-1')).resolves.toBe(true);

    expect(tx.stockReservation.updateMany).toHaveBeenCalledWith({
      where: { id: 'reservation-1', status: 'ACTIVE' },
      data: { status: 'EXPIRED', releasedAt: expect.any(Date) },
    });
  });

  it('não deve processar novamente uma reserva já reivindicada', async () => {
    tx.stockReservation.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.expireSingleReservation('reservation-1')).resolves.toBe(false);

    expect(tx.stockReservation.findUnique).not.toHaveBeenCalled();
    expect(tx.inventoryItem.updateMany).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('deve liberar múltiplos itens e registrar InventoryMovement para cada parcela', async () => {
    tx.stockReservation.updateMany.mockResolvedValue({ count: 1 });
    tx.stockReservation.findUnique.mockResolvedValue(
      reservationFixture([
        { inventoryItemId: 'inv-1', warehouseId: 'wh-1', variantId: 'v-1', quantity: 2 },
        { inventoryItemId: 'inv-2', warehouseId: 'wh-1', variantId: 'v-2', quantity: 3 },
      ]),
    );
    tx.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
    tx.inventoryItem.findUnique
      .mockResolvedValueOnce({ quantityAvailable: 7 })
      .mockResolvedValueOnce({ quantityAvailable: 10 });
    tx.orderGroup.updateMany.mockResolvedValue({ count: 1 });
    tx.outboxEvent.create.mockResolvedValue({});

    await service.expireSingleReservation('reservation-1');

    expect(tx.inventoryItem.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.inventoryMovement.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        inventoryItemId: 'inv-1',
        quantity: 2,
        previousQuantity: 5,
        newQuantity: 7,
        referenceType: 'STOCK_RESERVATION',
        referenceId: 'reservation-1',
      }),
    });
  });

  it('deve rejeitar conflito quando o saldo reservado mudou concorrentemente', async () => {
    tx.stockReservation.updateMany.mockResolvedValue({ count: 1 });
    tx.stockReservation.findUnique.mockResolvedValue(
      reservationFixture([
        { inventoryItemId: 'inv-1', warehouseId: 'wh-1', variantId: 'v-1', quantity: 2 },
      ]),
    );
    tx.inventoryItem.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.expireSingleReservation('reservation-1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('deve expirar somente pedidos ainda em PENDING_PAYMENT e criar histórico', async () => {
    tx.stockReservation.updateMany.mockResolvedValue({ count: 1 });
    tx.stockReservation.findUnique.mockResolvedValue({
      ...reservationFixture(),
      orderGroup: {
        id: 'group-1',
        status: 'PENDING_PAYMENT',
        orders: [
          { id: 'order-1', status: 'PENDING_PAYMENT' },
          { id: 'order-2', status: 'PAID' },
        ],
        couponRedemptions: [],
      },
    });
    tx.orderGroup.updateMany.mockResolvedValue({ count: 1 });
    tx.order.updateMany.mockResolvedValue({ count: 1 });
    tx.orderStatusHistory.create.mockResolvedValue({});
    tx.outboxEvent.create.mockResolvedValue({});

    await service.expireSingleReservation('reservation-1');

    expect(tx.order.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: 'PENDING_PAYMENT' },
      data: {
        status: 'EXPIRED',
        cancellationReason: 'Expiração automática por falta de pagamento',
      },
    });
    expect(tx.orderStatusHistory.create).toHaveBeenCalledTimes(1);
  });

  it('deve cancelar cupom de forma concorrente segura e nunca decrementar abaixo de zero', async () => {
    tx.stockReservation.updateMany.mockResolvedValue({ count: 1 });
    tx.stockReservation.findUnique.mockResolvedValue({
      ...reservationFixture(),
      orderGroup: {
        id: 'group-1',
        status: 'PENDING_PAYMENT',
        orders: [],
        couponRedemptions: [{ id: 'red-1', couponId: 'coupon-1', status: 'ACTIVE' }],
      },
    });
    tx.orderGroup.updateMany.mockResolvedValue({ count: 1 });
    tx.couponRedemption.updateMany.mockResolvedValue({ count: 1 });
    tx.coupon.updateMany.mockResolvedValue({ count: 0 });
    tx.outboxEvent.create.mockResolvedValue({});

    await service.expireSingleReservation('reservation-1');

    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 'coupon-1', currentUsageCount: { gt: 0 } },
      data: { currentUsageCount: { decrement: 1 } },
    });
  });

  it('deve gravar reservation.released e reservation.expired na mesma transação', async () => {
    tx.stockReservation.updateMany.mockResolvedValue({ count: 1 });
    tx.stockReservation.findUnique.mockResolvedValue(reservationFixture());
    tx.orderGroup.updateMany.mockResolvedValue({ count: 1 });
    tx.outboxEvent.create.mockResolvedValue({});

    await service.expireSingleReservation('reservation-1');

    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(2);
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'reservation.released' }),
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'reservation.expired' }),
    });
  });

  it('deve propagar falha de Outbox para que a transação seja revertida', async () => {
    tx.stockReservation.updateMany.mockResolvedValue({ count: 1 });
    tx.stockReservation.findUnique.mockResolvedValue(reservationFixture());
    tx.orderGroup.updateMany.mockResolvedValue({ count: 1 });
    tx.outboxEvent.create.mockRejectedValue(new Error('outbox unavailable'));

    await expect(service.expireSingleReservation('reservation-1')).rejects.toThrow(
      'outbox unavailable',
    );
  });

  it('deve processar somente reservas expiradas realmente reivindicadas', async () => {
    prisma.stockReservation.findMany.mockResolvedValue([
      { id: 'reservation-1' },
      { id: 'reservation-2' },
    ]);

    const spy = jest
      .spyOn(service, 'expireSingleReservation')
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(service.processExpiredReservations()).resolves.toBe(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
