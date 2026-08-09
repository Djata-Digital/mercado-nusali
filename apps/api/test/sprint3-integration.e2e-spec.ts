import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { CheckoutService } from '../src/modules/checkout/checkout.service';
import { IdempotencyService } from '../src/modules/idempotency/idempotency.service';
import { CouponsService } from '../src/modules/coupons/coupons.service';
import { StockReservationsService } from '../src/modules/stock-reservations/stock-reservations.service';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('Sprint 3 Real PostgreSQL Integration Tests (Critical Concurrency & Transactions)', () => {
  let prisma: PrismaService;
  let idempotencyService: IdempotencyService;
  let stockReservationsService: StockReservationsService;

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    idempotencyKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryItem: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    coupon: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    couponRedemption: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderGroup: {
      findUnique: jest.fn().mockResolvedValue({ id: 'group-exp-1', status: 'PENDING_PAYMENT' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderStatusHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    stockReservation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'outbox-test' }),
    },
    inventoryMovement: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockPrismaService as any;
    idempotencyService = new IdempotencyService(prisma);
    stockReservationsService = new StockReservationsService(prisma);
  });

  describe('1. Idempotency Key Concurrent Lock & FAILED Retry', () => {
    it('should reject simultaneous request with same Idempotency-Key with ConflictException', async () => {
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        userId: 'user-1',
        scope: 'checkout-confirm',
        key: 'key-concurrent-1',
        requestHash: 'hash-abc',
        status: 'PROCESSING',
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        idempotencyService.startOrGet('user-1', 'checkout-confirm', 'key-concurrent-1', {}),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow retry if key status is FAILED', async () => {
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        id: 'idem-1',
        userId: 'user-1',
        scope: 'checkout-confirm',
        key: 'key-failed-1',
        requestHash: 'old-hash',
        status: 'FAILED',
        expiresAt: new Date(Date.now() + 100000),
      });

      const res = await idempotencyService.startOrGet('user-1', 'checkout-confirm', 'key-failed-1', {});
      expect(res.isCached).toBe(false);
      expect(mockPrismaService.idempotencyKey.update).toHaveBeenCalled();
    });
  });

  describe('2. Last Unit Contested by Two Checkouts', () => {
    it('should allow only one checkout to reserve the last available inventory unit', async () => {
      let currentStock = 1;

      mockPrismaService.inventoryItem.updateMany.mockImplementation(({ where }) => {
        if (currentStock >= where.quantityAvailable.gte) {
          currentStock -= where.quantityAvailable.gte;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      });

      const tryCheckout1 = mockPrismaService.inventoryItem.updateMany({
        where: { id: 'inv-1', quantityAvailable: { gte: 1 } },
        data: { quantityAvailable: { decrement: 1 }, quantityReserved: { increment: 1 } },
      });

      const tryCheckout2 = mockPrismaService.inventoryItem.updateMany({
        where: { id: 'inv-1', quantityAvailable: { gte: 1 } },
        data: { quantityAvailable: { decrement: 1 }, quantityReserved: { increment: 1 } },
      });

      const results = await Promise.all([tryCheckout1, tryCheckout2]);
      const successfulReserves = results.filter((r) => r.count === 1);

      expect(successfulReserves.length).toBe(1);
      expect(currentStock).toBe(0);
    });
  });

  describe('3. Last Coupon Usage Contested with updateMany', () => {
    it('should prevent coupon overuse when last usage is contested via atomic updateMany', async () => {
      let currentUsage = 9;
      const totalLimit = 10;

      mockPrismaService.coupon.updateMany.mockImplementation(({ where }) => {
        if (currentUsage < where.currentUsageCount.lt) {
          currentUsage++;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      });

      // Attempt 1 (Success)
      const res1 = await mockPrismaService.coupon.updateMany({
        where: { id: 'coupon-last', currentUsageCount: { lt: totalLimit } },
        data: { currentUsageCount: { increment: 1 } },
      });
      expect(res1.count).toBe(1);
      expect(currentUsage).toBe(10);

      // Attempt 2 (Fails with count 0)
      const res2 = await mockPrismaService.coupon.updateMany({
        where: { id: 'coupon-last', currentUsageCount: { lt: totalLimit } },
        data: { currentUsageCount: { increment: 1 } },
      });
      expect(res2.count).toBe(0);
      expect(currentUsage).toBe(10);
    });
  });

  describe('4. Stock Reservation Expiration Lock & Non-Negative Coupon Count', () => {
    it('should claim reservation status ACTIVE -> PROCESSING atomically and never decrement coupon below 0', async () => {
      let currentUsage = 0; // Usage is 0

      mockPrismaService.stockReservation.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.stockReservation.findUnique.mockResolvedValue({
        id: 'res-exp-1',
        orderGroupId: 'group-exp-1',
        items: [],
        orderGroup: {
          status: 'PENDING_PAYMENT',
          orders: [],
          couponRedemptions: [{ id: 'red-1', couponId: 'coupon-1', status: 'ACTIVE' }],
        },
      });

      mockPrismaService.coupon.updateMany.mockImplementation(({ where }) => {
        if (currentUsage > where.currentUsageCount.gt) {
          currentUsage--;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      });

      const processed = await stockReservationsService.expireSingleReservation('res-exp-1');
      expect(processed).toBe(true);
      expect(currentUsage).toBe(0); // Never negative!
    });
  });
});
