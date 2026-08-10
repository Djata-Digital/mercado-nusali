import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Prisma, PaymentStatus, EscrowStatus } from '@prisma/client';
import { WebhooksService } from '../src/modules/webhooks/webhooks.service';
import { RefundsService } from '../src/modules/refunds/refunds.service';
import { PayoutsService } from '../src/modules/payouts/payouts.service';
import { EscrowService } from '../src/modules/escrow/escrow.service';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { PaymentIntentsService } from '../src/modules/payments/payment-intents.service';
import { PaymentsService } from '../src/modules/payments/payments.service';

describe('Sprint 4 Financial Infrastructure (HTTP E2E - Mocked Infrastructure)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  const mockUserActive = {
    id: 'user-fin-e2e',
    firstName: 'Fin',
    lastName: 'User',
    email: 'fin@example.com',
    phone: '955111222',
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
            { permission: { slug: 'payment:create:self' } },
            { permission: { slug: 'payment:read:self' } },
            { permission: { slug: 'payment:capture:manage' } },
            { permission: { slug: 'wallet:read:self' } },
            { permission: { slug: 'wallet:deposit:self' } },
            { permission: { slug: 'wallet:withdraw:self' } },
            { permission: { slug: 'escrow:read:self' } },
            { permission: { slug: 'escrow:release:manage' } },
            { permission: { slug: 'payout:read:self' } },
            { permission: { slug: 'payout:request:manage' } },
            { permission: { slug: 'payout:process:admin' } },
            { permission: { slug: 'refund:create:self' } },
            { permission: { slug: 'refund:read:self' } },
          ],
        },
      },
    ],
  };

  const mockOrderGroup = {
    id: 'group-fin-e2e',
    userId: 'user-fin-e2e',
    currencyId: 'curr-gw',
    total: new Prisma.Decimal(1000),
    status: 'PENDING_PAYMENT',
    currency: { code: 'XOF' },
    orders: [
      {
        id: 'order-fin-1',
        orderNumber: 'NSL-GW-FIN100',
        userId: 'user-fin-e2e',
        sellerId: 'seller-fin-1',
        storeId: 'store-fin-1',
        subtotal: new Prisma.Decimal(1000),
        shippingAmount: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        estimatedTaxAmount: new Prisma.Decimal(0),
        total: new Prisma.Decimal(1000),
        status: 'PENDING_PAYMENT',
      },
    ],
  };

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    user: { findUnique: jest.fn().mockResolvedValue(mockUserActive) },
    userSession: { findUnique: jest.fn().mockResolvedValue({ id: 'session-fin', userId: 'user-fin-e2e', isRevoked: false, expiresAt: new Date(Date.now() + 1000000), user: mockUserActive }) },
    currency: { findFirst: jest.fn().mockResolvedValue({ id: 'curr-gw', code: 'XOF' }), findUnique: jest.fn().mockResolvedValue({ id: 'curr-gw', code: 'XOF' }) },
    orderGroup: { findUnique: jest.fn().mockResolvedValue(mockOrderGroup), update: jest.fn().mockResolvedValue(mockOrderGroup) },
    order: { findUnique: jest.fn().mockResolvedValue(mockOrderGroup.orders[0]), update: jest.fn().mockResolvedValue(mockOrderGroup.orders[0]) },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    paymentIntent: {
      findUnique: jest.fn().mockResolvedValue({ id: 'intent-fin-e2e', orderGroupId: 'group-fin-e2e', buyerId: 'user-fin-e2e', amount: new Prisma.Decimal(1000), currencyId: 'curr-gw', status: PaymentStatus.CREATED, currency: { code: 'XOF' } }),
      create: jest.fn().mockResolvedValue({ id: 'intent-fin-e2e', orderGroupId: 'group-fin-e2e', buyerId: 'user-fin-e2e', amount: new Prisma.Decimal(1000), currencyId: 'curr-gw', status: PaymentStatus.CREATED, currency: { code: 'XOF' } }),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({ id: 'payment-fin-e2e', paymentIntentId: 'intent-fin-e2e', orderGroupId: 'group-fin-e2e', buyerId: 'user-fin-e2e', amount: new Prisma.Decimal(1000), currencyId: 'curr-gw', method: 'ORANGE_MONEY', provider: 'ORANGE', status: PaymentStatus.CAPTURED, orderGroup: mockOrderGroup }),
      create: jest.fn().mockResolvedValue({ id: 'payment-fin-e2e', paymentIntentId: 'intent-fin-e2e', orderGroupId: 'group-fin-e2e', buyerId: 'user-fin-e2e', amount: new Prisma.Decimal(1000), currencyId: 'curr-gw', method: 'ORANGE_MONEY', provider: 'ORANGE', status: PaymentStatus.PENDING }),
      update: jest.fn().mockResolvedValue({ id: 'payment-fin-e2e', status: PaymentStatus.CAPTURED, amount: new Prisma.Decimal(1000), buyerId: 'user-fin-e2e' }),
    },
    paymentAttempt: { create: jest.fn().mockResolvedValue({}) },
    paymentEvent: { create: jest.fn().mockResolvedValue({}) },
    wallet: {
      findUnique: jest.fn().mockResolvedValue({ id: 'wallet-fin', userId: 'user-fin-e2e', balanceAvailable: new Prisma.Decimal(5000), balanceBlocked: new Prisma.Decimal(0), currencyId: 'curr-gw', status: 'ACTIVE', currency: { code: 'XOF' } }),
      create: jest.fn().mockResolvedValue({ id: 'wallet-fin', userId: 'user-fin-e2e', balanceAvailable: new Prisma.Decimal(5000), balanceBlocked: new Prisma.Decimal(0), currencyId: 'curr-gw', status: 'ACTIVE' }),
      update: jest.fn().mockResolvedValue({ id: 'wallet-fin', balanceAvailable: new Prisma.Decimal(6000) }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    walletTransaction: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    ledgerEntry: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    escrowAccount: {
      findUnique: jest.fn().mockResolvedValue({ id: 'escrow-fin-e2e', orderGroupId: 'group-fin-e2e', orderId: 'order-fin-1', sellerId: 'seller-fin-1', buyerId: 'user-fin-e2e', totalAmount: new Prisma.Decimal(1000), heldAmount: new Prisma.Decimal(1000), commissionAmount: new Prisma.Decimal(100), currencyId: 'curr-gw', status: EscrowStatus.HELD, seller: { id: 'seller-fin-1', userId: 'user-seller-fin' } }),
      create: jest.fn().mockResolvedValue({ id: 'escrow-fin-e2e', status: EscrowStatus.HELD }),
      update: jest.fn().mockResolvedValue({ id: 'escrow-fin-e2e', status: EscrowStatus.RELEASED }),
    },
    escrowTransaction: { create: jest.fn().mockResolvedValue({}) },
    sellerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'seller-fin-1', userId: 'user-fin-e2e', status: 'VERIFIED' }) },
    payout: {
      create: jest.fn().mockResolvedValue({ id: 'payout-fin-e2e', sellerId: 'seller-fin-1', amount: new Prisma.Decimal(500), status: 'CREATED' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'payout-fin-e2e', sellerId: 'seller-fin-1', amount: new Prisma.Decimal(500), status: 'CREATED' }),
      update: jest.fn().mockResolvedValue({ id: 'payout-fin-e2e', status: 'PAID' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    refund: {
      create: jest.fn().mockResolvedValue({ id: 'refund-fin-e2e', paymentId: 'payment-fin-e2e', orderId: 'order-fin-1', buyerId: 'user-fin-e2e', amount: new Prisma.Decimal(1000), status: 'COMPLETED' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    webhookEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'wh-e2e' }),
      update: jest.fn().mockResolvedValue({}),
    },
    outboxEvent: { create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
    idempotencyKey: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
  };

  const mockPaymentIntentsService = {
    createIntent: jest.fn().mockResolvedValue({
      id: 'intent-fin-e2e',
      orderGroupId: 'group-fin-e2e',
      buyerId: 'user-fin-e2e',
      amount: new Prisma.Decimal(1000),
      currencyId: 'curr-gw',
      status: PaymentStatus.CREATED,
    }),
    getIntentById: jest.fn(),
  };

  const mockPaymentsService = {
    processPayment: jest.fn().mockResolvedValue({
      id: 'payment-fin-e2e',
      paymentIntentId: 'intent-fin-e2e',
      status: PaymentStatus.PENDING,
      provider: 'ORANGE',
    }),
    capturePayment: jest.fn(),
    getPaymentById: jest.fn(),
  };

  const mockWalletService = {
    getWalletBalance: jest.fn().mockResolvedValue({
      id: 'wallet-fin',
      userId: 'user-fin-e2e',
      currencyId: 'curr-gw',
      balanceAvailable: '5000.00',
      balanceBlocked: '0.00',
      status: 'ACTIVE',
    }),
    getTransactions: jest.fn().mockResolvedValue([]),
    deposit: jest.fn().mockResolvedValue({
      wallet: {
        id: 'wallet-fin',
        balanceAvailable: '6000.00',
      },
      transaction: {
        id: 'wallet-tx-deposit-e2e',
        type: 'DEPOSIT',
        amount: '1000.00',
      },
    }),
    withdraw: jest.fn(),
  };

  const mockEscrowService = {
    getEscrowByOrderId: jest.fn(),
    releaseEscrow: jest.fn().mockResolvedValue({
      id: 'escrow-fin-e2e',
      orderId: 'order-fin-1',
      status: EscrowStatus.RELEASED,
      heldAmount: '0.00',
      releasedAmount: '1000.00',
    }),
    releasePartial: jest.fn(),
    refundEscrow: jest.fn(),
    cancelEscrow: jest.fn(),
    openDispute: jest.fn(),
    resolveDispute: jest.fn(),
  };

  const mockPayoutsService = {
    listSellerPayouts: jest.fn().mockResolvedValue([]),
    requestPayout: jest.fn().mockResolvedValue({
      id: 'payout-fin-e2e',
      sellerId: 'seller-fin-1',
      amount: '500.00',
      currencyId: 'curr-gw',
      status: 'CREATED',
    }),
    processPayout: jest.fn(),
    cancelPayout: jest.fn(),
    failPayout: jest.fn(),
    reconcilePayout: jest.fn(),
    listReconciliationIssues: jest.fn(),
  };

  const mockRefundsService = {
    processRefund: jest.fn().mockResolvedValue({
      id: 'refund-fin-e2e',
      paymentId: 'payment-fin-e2e',
      orderId: 'order-fin-1',
      buyerId: 'user-fin-e2e',
      amount: '1000.00',
      status: 'COMPLETED',
    }),
    retryRefund: jest.fn(),
    listBuyerRefunds: jest.fn().mockResolvedValue([]),
  };

  const mockWebhooksService = {
    processWebhook: jest.fn().mockResolvedValue({
      success: true,
      data: {
        eventId: 'evt-e2e-100',
        processed: true,
      },
    }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(PaymentIntentsService)
      .useValue(mockPaymentIntentsService)
      .overrideProvider(PaymentsService)
      .useValue(mockPaymentsService)
      .overrideProvider(WalletService)
      .useValue(mockWalletService)
      .overrideProvider(EscrowService)
      .useValue(mockEscrowService)
      .overrideProvider(PayoutsService)
      .useValue(mockPayoutsService)
      .overrideProvider(RefundsService)
      .useValue(mockRefundsService)
      .overrideProvider(WebhooksService)
      .useValue(mockWebhooksService)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    jwtService = app.get<JwtService>(JwtService);
    authToken = jwtService.sign({
      id: 'user-fin-e2e',
      sub: 'user-fin-e2e',
      email: 'fin@example.com',
      sessionId: 'session-fin',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('End-to-End Financial Operations', () => {
    it('POST /api/v1/payments/intent (Create Payment Intent)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ orderGroupId: 'group-fin-e2e' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/payments/process (Process Payment)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', 'idem-fin-proc-1')
        .send({
          paymentIntentId: 'intent-fin-e2e',
          method: 'ORANGE_MONEY',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/wallet/balance (Get Wallet Balance)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.balanceAvailable).toBe('5000.00');
    });

    it('POST /api/v1/wallet/deposit (Deposit into Wallet)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/wallet/deposit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 1000,
          currencyId: 'curr-gw',
          description: 'Depósito E2E',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/escrow/release (Release Escrow to Seller)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/escrow/release')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ orderId: 'order-fin-1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/payouts/request (Request Payout for Seller)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payouts/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 500, currencyId: 'curr-gw' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/refunds (Request & Process Refund)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/refunds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentId: 'payment-fin-e2e',
          orderId: 'order-fin-1',
          amount: 1000,
          reason: 'Insatisfação com o item',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/webhooks/ORANGE (Public Webhook Receiver)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/ORANGE')
        .send({
          eventId: 'evt-e2e-100',
          eventType: 'payment.captured',
          payload: { paymentId: 'payment-fin-e2e' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
