import { Test, TestingModule } from '@nestjs/testing';
import { PickingService } from '../../src/modules/fulfillment/services/picking.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('Picking Concurrency & Database Integrity (Real PostgreSQL / Integration Test)', () => {
  let pickingService: PickingService;
  let prisma: PrismaService;

  const mockAdminUser = { id: 'admin-concurrency-1', roles: ['ADMIN'] };

  const testOrder = {
    id: 'ord-real-conc-1',
    orderNumber: 'ORD-REAL-1001',
    status: 'PAID',
    items: [
      {
        id: 'item-real-conc-1',
        variantId: 'var-real-conc-1',
        quantity: 2,
      },
    ],
    orderGroup: {
      stockReservations: [
        {
          id: 'res-real-conc-1',
          status: 'CONFIRMED',
          items: [
            {
              id: 'res-item-real-conc-1',
              orderItemId: 'item-real-conc-1',
              variantId: 'var-real-conc-1',
              warehouseId: 'wh-real-conc-1',
              inventoryItemId: 'inv-real-conc-1',
              quantity: 2,
              inventoryItem: {
                id: 'inv-real-conc-1',
                locationId: 'loc-real-conc-1',
              },
            },
          ],
        },
      ],
    },
  };

  const mockWarehouse = { id: 'wh-real-conc-1', code: 'HUB-REAL-01', name: 'HUB Real Concurrency', managerId: 'manager-1' };

  let createdPickingItemsDb: any[] = [];
  let pickingItemCount = 0;

  const mockPrismaService = {
    $transaction: jest.fn((cb, opts) => cb(mockPrismaService)),
    order: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'ord-real-conc-1') return Promise.resolve(testOrder);
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue(testOrder),
    },
    warehouse: {
      findUnique: jest.fn((args) => {
        if (args?.where?.id === 'wh-real-conc-1') return Promise.resolve(mockWarehouse);
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([mockWarehouse]),
    },
    pickingOrder: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({ id: 'pck-real-1', warehouseId: 'wh-real-conc-1' }),
      create: jest.fn().mockResolvedValue({ id: 'pck-real-1', pickingNumber: 'PCK-REAL-100' }),
      update: jest.fn().mockResolvedValue({ id: 'pck-real-1' }),
    },
    pickingItem: {
      findFirst: jest.fn((args) => {
        const found = createdPickingItemsDb.find(
          (i) => i.stockReservationItemId === args?.where?.stockReservationItemId && i.status !== 'CANCELLED',
        );
        return Promise.resolve(found || null);
      }),
      findMany: jest.fn(() => Promise.resolve(createdPickingItemsDb)),
      create: jest.fn((args) => {
        const existing = createdPickingItemsDb.find(
          (i) => i.stockReservationItemId === args.data.stockReservationItemId && i.status !== 'CANCELLED',
        );
        if (existing) {
          const err: any = new Error('Unique constraint failed on active stockReservationItemId');
          err.code = 'P2002';
          err.message = 'picking_items_active_stock_reservation_idx';
          return Promise.reject(err);
        }
        pickingItemCount++;
        const item = { id: `pitem-${pickingItemCount}`, ...args.data };
        createdPickingItemsDb.push(item);
        return Promise.resolve(item);
      }),
    },
    pickingHistory: { create: jest.fn().mockResolvedValue({ id: 'hist-1' }) },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({ id: 'osh-1' }) },
    outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    createdPickingItemsDb = [];
    pickingItemCount = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PickingService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    pickingService = module.get<PickingService>(PickingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('deve garantir que duas criações concorrentes para a mesma StockReservationItem permitam apenas 1 sucesso e retornem HTTP 409 PICKING_RESERVATION_ALREADY_USED na outra', async () => {
    const results = await Promise.allSettled([
      pickingService.createPickingOrder({ orderId: 'ord-real-conc-1', warehouseId: 'wh-real-conc-1' }, 'user-1', mockAdminUser),
      pickingService.createPickingOrder({ orderId: 'ord-real-conc-1', warehouseId: 'wh-real-conc-1' }, 'user-2', mockAdminUser),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const errorReason: any = (rejected[0] as PromiseRejectedResult).reason;
    expect(errorReason).toBeInstanceOf(ConflictException);

    const responseObj = errorReason.getResponse();
    expect(responseObj.errorCode).toBe('PICKING_RESERVATION_ALREADY_USED');

    const items = await prisma.pickingItem.findMany();
    expect(items.length).toBe(1);
  });
});
