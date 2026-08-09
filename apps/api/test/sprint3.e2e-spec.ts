import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { CheckoutService } from '../src/modules/checkout/checkout.service';

describe('Sprint 3 Checkout & Orders System (HTTP E2E - Mocked Infrastructure)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  const mockUserActive = {
    id: 'user-e2e',
    firstName: 'Buyer',
    lastName: 'E2E',
    email: 'buyer@example.com',
    phone: '955123456',
    phoneCode: '+245',
    passwordHash: 'hash',
    status: 'active',
    isEmailVerified: true,
    isPhoneVerified: true,
    countryId: 'country-gw',
    preferredCurrencyId: 'curr-gw',
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [
      {
        role: {
          name: 'BUYER',
          permissions: [
            { permission: { slug: 'address:read:self' } },
            { permission: { slug: 'address:create:self' } },
            { permission: { slug: 'address:update:self' } },
            { permission: { slug: 'address:delete:self' } },
            { permission: { slug: 'cart:manage:self' } },
            { permission: { slug: 'checkout:create:self' } },
            { permission: { slug: 'order:read:self' } },
            { permission: { slug: 'order:cancel:self' } },
          ],
        },
      },
    ],
  };

  const mockSessionActive = {
    id: 'session-e2e',
    userId: 'user-e2e',
    isRevoked: false,
    expiresAt: new Date(Date.now() + 1000000),
    user: mockUserActive,
  };

  const mockAddress = {
    id: 'addr-100',
    userId: 'user-e2e',
    recipientName: 'Comprador E2E',
    phone: '955123456',
    phoneCode: '+245',
    countryId: 'country-gw',
    region: 'Bissau',
    city: 'Bissau',
    street: 'Rua 10',
    number: '20',
    isDefault: true,
    type: 'RESIDENTIAL',
    isActive: true,
    country: { code: 'GW' },
  };

  const mockSeller = { id: 'seller-e2e', legalName: 'Vendedor E2E', tradeName: 'Vendedor E2E', status: 'VERIFIED' };
  const mockStore = { id: 'store-e2e', name: 'Loja E2E', slug: 'loja-e2e', status: 'ACTIVE', countryId: 'country-gw', country: { code: 'GW', defaultCurrencyId: 'curr-gw' }, seller: mockSeller };

  const mockCartItem = {
    id: 'item-100',
    storeId: 'store-e2e',
    productId: 'prod-e2e',
    variantId: 'var-e2e',
    quantity: 2,
    unitPriceSnapshot: new Prisma.Decimal(100),
    product: { title: 'Produto E2E', productType: 'PHYSICAL', weight: 1.0, status: 'APPROVED', store: mockStore },
    variant: { name: 'Variante E2E', sku: 'SKU-E2E', price: new Prisma.Decimal(100), status: 'ACTIVE', weight: 1.0 },
    store: mockStore,
  };

  const mockCart = {
    id: 'cart-100',
    userId: 'user-e2e',
    currencyId: 'curr-gw',
    status: 'ACTIVE',
    currency: { code: 'XOF' },
    items: [mockCartItem],
  };

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    user: { findUnique: jest.fn().mockResolvedValue(mockUserActive) },
    userSession: { findUnique: jest.fn().mockResolvedValue(mockSessionActive) },
    country: { findUnique: jest.fn().mockResolvedValue({ id: 'country-gw', code: 'GW' }) },
    store: { findUnique: jest.fn().mockResolvedValue(mockStore) },
    productVariant: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'var-e2e',
        weight: 1.0,
        product: { title: 'Produto E2E', productType: 'PHYSICAL', weight: 1.0 },
      }),
    },
    inventoryItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'inv-e2e',
          variantId: 'var-e2e',
          quantityAvailable: 100,
          quantityReserved: 0,
          warehouseId: 'wh-e2e',
          warehouse: { id: 'wh-e2e', type: 'NUSALI_HUB', countryId: 'country-gw', country: { code: 'GW' }, status: 'ACTIVE' },
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({ id: 'inv-e2e', quantityAvailable: 100 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    address: {
      create: jest.fn().mockResolvedValue(mockAddress),
      findMany: jest.fn().mockResolvedValue([mockAddress]),
      findUnique: jest.fn().mockResolvedValue(mockAddress),
      update: jest.fn().mockResolvedValue(mockAddress),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    cart: {
      findFirst: jest.fn().mockResolvedValue(mockCart),
      create: jest.fn().mockResolvedValue(mockCart),
      update: jest.fn().mockResolvedValue(mockCart),
    },
    cartItem: {
      upsert: jest.fn().mockResolvedValue({ id: 'item-100' }),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    coupon: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'coupon-100',
        code: 'PROMO2026',
        type: 'PERCENTAGE',
        value: 10,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 10000),
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    checkoutSession: {
      create: jest.fn().mockResolvedValue({
        id: 'session-e2e',
        status: 'CREATED',
        expiresAt: new Date(Date.now() + 900000),
        shippingQuotesJson: [
          { storeId: 'store-e2e', options: [{ serviceCode: 'STANDARD', name: 'Standard', amount: '100.00' }] },
        ],
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-e2e',
        userId: 'user-e2e',
        status: 'CREATED',
        expiresAt: new Date(Date.now() + 900000),
        cart: mockCart,
        address: mockAddress,
        currency: { code: 'XOF' },
        shippingQuotesJson: [
          { storeId: 'store-e2e', options: [{ serviceCode: 'STANDARD', name: 'Standard', amount: '100.00' }] },
        ],
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    idempotencyKey: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    orderGroup: {
      create: jest.fn().mockResolvedValue({
        id: 'group-e2e',
        status: 'PENDING_PAYMENT',
        subtotal: '1000.00',
        total: '1100.00',
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    order: {
      create: jest.fn().mockResolvedValue({
        id: 'order-e2e',
        orderNumber: 'NSL-GW-20260802-E2E100',
        status: 'PENDING_PAYMENT',
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    orderItem: { create: jest.fn().mockResolvedValue({}) },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    stockReservation: { create: jest.fn().mockResolvedValue({ id: 'res-e2e' }) },
    stockReservationItem: { create: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const mockCheckoutService = {
    createCheckoutSession: jest.fn().mockResolvedValue({
      session: {
        id: 'session-e2e',
        status: 'CREATED',
        expiresAt: new Date(Date.now() + 900000),
      },
      cartSummary: {
        subtotal: new Prisma.Decimal(200),
        grandTotal: new Prisma.Decimal(200),
      },
      stores: [],
      shippingQuotes: {},
    }),
    confirmCheckout: jest.fn().mockResolvedValue({
      orderGroup: {
        id: 'group-e2e',
        status: 'PENDING_PAYMENT',
      },
      orders: [
        {
          id: 'order-e2e',
          orderNumber: 'NSL-GW-20260802-E2E100',
          status: 'PENDING_PAYMENT',
        },
      ],
      stockReservation: {
        id: 'res-e2e',
        status: 'ACTIVE',
      },
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(CheckoutService)
      .useValue(mockCheckoutService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({ sub: mockUserActive.id, sessionId: mockSessionActive.id });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Sprint 3 Endpoints Flow', () => {
    it('POST /api/v1/addresses (Create Address)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/addresses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientName: 'Comprador E2E',
          phone: '955123456',
          phoneCode: '+245',
          countryId: 'country-gw',
          region: 'Bissau',
          city: 'Bissau',
          street: 'Rua 10',
          number: '20',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('addr-100');
    });

    it('GET /api/v1/cart (Get Cart)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/checkout/session (Create Checkout Session)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/checkout/session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ addressId: 'addr-100' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session.id).toBe('session-e2e');
    });

    it('POST /api/v1/checkout/confirm (Confirm Checkout with Idempotency-Key)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/checkout/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'idem-e2e-100')
        .send({
          checkoutSessionId: 'session-e2e',
          shippingSelections: [{ storeId: 'store-e2e', serviceCode: 'STANDARD' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
