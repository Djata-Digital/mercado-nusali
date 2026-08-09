import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from './prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { AddressesService } from './addresses/addresses.service';
import { CartsService } from './carts/carts.service';
import { CouponsService } from './coupons/coupons.service';
import { ShippingQuotesService } from './shipping-quotes/shipping-quotes.service';
import { EstimatedTaxService } from './estimated-tax/estimated-tax.service';
import { InventoryAvailabilityService } from './inventory-availability/inventory-availability.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { CheckoutShippingSelectionService } from './checkout/services/checkout-shipping-selection.service';
import { OrdersService } from './orders/orders.service';
import { OrderStateMachineService } from './orders/order-state-machine.service';
import { StockReservationsService } from './stock-reservations/stock-reservations.service';
import { StorePermissionsService } from '../common/services/store-permissions.service';
import { CouponStatus, Prisma } from '@prisma/client';

describe('Sprint 3 Complete Unit Tests (Requirements 1-17)', () => {
  let addressesService: AddressesService;
  let cartsService: CartsService;
  let couponsService: CouponsService;
  let checkoutShippingSelectionService: CheckoutShippingSelectionService;
  let ordersService: OrdersService;
  let stockReservationsService: StockReservationsService;
  let estimatedTaxService: EstimatedTaxService;
  let idempotencyService: IdempotencyService;

  const mockPrismaService = {
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', preferredCurrencyId: 'curr-1' }) },
    country: { findUnique: jest.fn(), findFirst: jest.fn() },
    currency: { findUnique: jest.fn(), findFirst: jest.fn() },
    address: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    cart: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
    },
    coupon: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    couponRedemption: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
    },
    sellerProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    storeMember: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    inventoryItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
    },
    checkoutSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    idempotencyKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    orderGroup: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderItem: {
      create: jest.fn(),
    },
    orderStatusHistory: {
      create: jest.fn(),
    },
    orderTimeline: {
      create: jest.fn(),
    },
    orderAddressSnapshot: {
      create: jest.fn(),
    },
    orderPriceSnapshot: {
      create: jest.fn(),
    },
    orderShipping: {
      create: jest.fn(),
    },
    orderCoupon: {
      create: jest.fn(),
    },
    outboxEvent: {
      create: jest.fn(),
    },
    stockReservation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    stockReservationItem: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockAuditService = { log: jest.fn().mockResolvedValue({}) };
  const mockStorePermissionsService = { validateStoreAccess: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        AddressesService,
        CartsService,
        CouponsService,
        ShippingQuotesService,
        EstimatedTaxService,
        InventoryAvailabilityService,
        IdempotencyService,
        CheckoutShippingSelectionService,
        OrdersService,
        OrderStateMachineService,
        StockReservationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: StorePermissionsService, useValue: mockStorePermissionsService },
      ],
    }).compile();

    addressesService = module.get<AddressesService>(AddressesService);
    cartsService = module.get<CartsService>(CartsService);
    couponsService = module.get<CouponsService>(CouponsService);
    checkoutShippingSelectionService = module.get<CheckoutShippingSelectionService>(
      CheckoutShippingSelectionService,
    );
    ordersService = module.get<OrdersService>(OrdersService);
    stockReservationsService = module.get<StockReservationsService>(StockReservationsService);
    estimatedTaxService = module.get<EstimatedTaxService>(EstimatedTaxService);
    idempotencyService = module.get<IdempotencyService>(IdempotencyService);
  });

  describe('1. BullMQ & Stock Expiration', () => {
    it('expireSingleReservation should claim status ACTIVE -> EXPIRED atomically', async () => {
      mockPrismaService.stockReservation.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.stockReservation.findUnique.mockResolvedValue({
        id: 'res-1',
        orderGroupId: 'group-1',
        items: [],
        orderGroup: { status: 'PENDING_PAYMENT', orders: [], couponRedemptions: [] },
      });

      const res = await stockReservationsService.expireSingleReservation('res-1');
      expect(res).toBe(true);
      expect(mockPrismaService.stockReservation.updateMany).toHaveBeenCalledWith({
        where: { id: 'res-1', status: 'ACTIVE' },
        data: { status: 'EXPIRED', releasedAt: expect.any(Date) },
      });
    });

    it('expireSingleReservation should return false if reservation was already claimed/expired', async () => {
      mockPrismaService.stockReservation.updateMany.mockResolvedValue({ count: 0 });

      const res = await stockReservationsService.expireSingleReservation('res-1');
      expect(res).toBe(false);
    });
  });

  describe('2. Coupon Global & Per-User Concurrency', () => {
    it('validateCoupon should check firstPurchaseOnly rule', async () => {
      mockPrismaService.coupon.findUnique.mockResolvedValue({
        code: 'PRIMEIRA',
        status: CouponStatus.ACTIVE,
        startsAt: new Date(Date.now() - 1000),
        rules: [{ firstPurchaseOnly: true }],
      });
      mockPrismaService.order.count.mockResolvedValue(1);

      await expect(
        couponsService.validateCoupon('user-1', { code: 'PRIMEIRA', subtotal: 100, currencyId: 'curr-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Idempotency Key FAILED & Expired Retry', () => {
    it('startOrGet should allow retry if previous attempt failed or expired', async () => {
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        id: 'idem-1',
        userId: 'user-1',
        scope: 'checkout-confirm',
        key: 'key-1',
        requestHash: 'old-hash',
        status: 'FAILED',
        expiresAt: new Date(Date.now() + 10000),
      });

      const res = await idempotencyService.startOrGet('user-1', 'checkout-confirm', 'key-1', { test: true });
      expect(res.isCached).toBe(false);
      expect(mockPrismaService.idempotencyKey.update).toHaveBeenCalled();
    });
  });

  describe('4. Real Origin-Based Estimated Tax', () => {
    it('should calculate 5% tax for international warehouse origin vs delivery destination', () => {
      const tax = estimatedTaxService.calculateItemEstimatedTax(
        new Prisma.Decimal(100),
        'country-br',
        'country-gw',
      );
      expect(Number(tax)).toBe(5);
    });

    it('should calculate 0 tax for national origin vs destination', () => {
      const tax = estimatedTaxService.calculateItemEstimatedTax(
        new Prisma.Decimal(100),
        'country-gw',
        'country-gw',
      );
      expect(Number(tax)).toBe(0);
    });
  });

  describe('5. Checkout Revalidations & Errors', () => {
    it('shipping selection should throw SHIPPING_SELECTION_REQUIRED when a physical store has multiple options and none is selected', () => {
      expect(() =>
        checkoutShippingSelectionService.resolve({
          storeIds: ['store-1'],
          shippingQuotesJson: {
            'store-1': [
              {
                providerCode: 'INTERNAL',
                serviceCode: 'STANDARD',
                serviceName: 'Standard',
                cost: '1000',
                estimatedMinDays: 2,
                estimatedMaxDays: 5,
              },
              {
                providerCode: 'INTERNAL',
                serviceCode: 'EXPRESS',
                serviceName: 'Express',
                cost: '2000',
                estimatedMinDays: 1,
                estimatedMaxDays: 2,
              },
            ],
          },
          selections: [],
        }),
      ).toThrow(BadRequestException);

      try {
        checkoutShippingSelectionService.resolve({
          storeIds: ['store-1'],
          shippingQuotesJson: {
            'store-1': [
              {
                providerCode: 'INTERNAL',
                serviceCode: 'STANDARD',
                serviceName: 'Standard',
                cost: '1000',
                estimatedMinDays: 2,
                estimatedMaxDays: 5,
              },
              {
                providerCode: 'INTERNAL',
                serviceCode: 'EXPRESS',
                serviceName: 'Express',
                cost: '2000',
                estimatedMinDays: 1,
                estimatedMaxDays: 2,
              },
            ],
          },
          selections: [],
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          errorCode: 'CHECKOUT_SHIPPING_SELECTION_REQUIRED',
        });
      }
    });
  });

  describe('6. Store Members Access & Order Cancellation', () => {
    it('listSellerOrders should allow active store member (MANAGER) to query store orders', async () => {
      mockPrismaService.sellerProfile.findUnique.mockResolvedValue(null);
      mockPrismaService.storeMember.findMany.mockResolvedValue([
        { storeId: 'store-authorized', role: 'MANAGER', status: 'ACTIVE' },
      ]);
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      const res = await ordersService.listSellerOrders('user-member-1', {});
      expect(res.items).toEqual([]);
    });

    it('cancelOrder should cancel single order independently without cancelling entire group', async () => {
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        orderGroupId: 'group-1',
        orderNumber: 'NSL-GW-20260802-100',
        status: 'PENDING_PAYMENT',
        items: [{ variantId: 'var-1', warehouseId: 'wh-1', quantity: 1 }],
        orderGroup: {
          id: 'group-1',
          stockReservations: [],
          couponRedemptions: [],
        },
      });

      mockPrismaService.order.findMany.mockResolvedValue([
        { id: 'order-1', status: 'CANCELLED' },
        { id: 'order-2', status: 'PENDING_PAYMENT' },
      ]);

      mockPrismaService.inventoryItem.findFirst.mockResolvedValue({ id: 'inv-1', quantityAvailable: 10, quantityReserved: 1 });
      mockPrismaService.inventoryItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.inventoryItem.findUnique.mockResolvedValue({ id: 'inv-1', quantityAvailable: 11 });

      const res: any = await ordersService.cancelOrder('user-1', 'order-1', { reason: 'Mudança de ideia' }, 'idem-cancel-1', {});
      expect(res.success).toBe(true);
      expect(mockPrismaService.orderGroup.update).not.toHaveBeenCalled();
    });
  });
});
