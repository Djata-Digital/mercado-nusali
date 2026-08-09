import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EscrowStatus,
  OrderStatus,
  PaymentMethodType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RefundStatus,
  SellerStatus,
  StoreStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

import { EscrowService } from '../../src/modules/escrow/escrow.service';
import { EscrowDisputePolicyService } from '../../src/modules/escrow/services/escrow-dispute-policy.service';
import { EscrowEventsService } from '../../src/modules/escrow/services/escrow-events.service';
import { EscrowRefundPolicyService } from '../../src/modules/escrow/services/escrow-refund-policy.service';
import { EscrowReleasePolicyService } from '../../src/modules/escrow/services/escrow-release-policy.service';
import { EscrowStateMachineService } from '../../src/modules/escrow/services/escrow-state-machine.service';
import { EscrowTransactionService } from '../../src/modules/escrow/services/escrow-transaction.service';
import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { OutboxService } from '../../src/modules/outbox/outbox.service';
import {
  PaymentGatewayErrorClassifierService,
  PaymentGatewayException,
} from '../../src/modules/payments/services/payment-gateway-error-classifier.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { RefundProviderExecutionService } from '../../src/modules/refunds/services/refund-provider-execution.service';
import { RefundProviderWebhookService } from '../../src/modules/refunds/services/refund-provider-webhook.service';
import { RefundReconciliationService } from '../../src/modules/refunds/services/refund-reconciliation.service';
import { RefundTransactionService } from '../../src/modules/refunds/services/refund-transaction.service';
import { WalletService } from '../../src/modules/wallet/wallet.service';

type SeededRefundDomain = {
  buyerId: string;
  sellerId: string;
  orderId: string;
  orderGroupId: string;
  paymentId: string;
  escrowId: string;
  currencyId: string;
  totalAmount: Prisma.Decimal;
};

type FakeProviderCall = {
  paymentId: string;
  providerTransactionId: string;
  amount: Prisma.Decimal;
  metadata?: { refundId?: string; idempotencyKey?: string };
};

describe('Sprint 7.4.3.1 - Refund Webhooks & Reconciliation Real PostgreSQL', () => {
  jest.setTimeout(120000);

  const dbUrlTest = process.env.DATABASE_URL_TEST || '';

  let prisma: PrismaService;
  let rawPrisma: PrismaClient;
  let escrowService: EscrowService;
  let refundTransaction: RefundTransactionService;
  let classifier: PaymentGatewayErrorClassifierService;

  beforeAll(async () => {
    if (!dbUrlTest) {
      throw new Error(
        'DATABASE_URL_TEST é obrigatória para a Sprint 7.4.2.1. Use um PostgreSQL isolado cujo nome contenha "_test".',
      );
    }

    if (!dbUrlTest.includes('_test')) {
      throw new Error(
        `Segurança de Dados: DATABASE_URL_TEST ("${dbUrlTest}") deve conter "_test" no nome do banco.`,
      );
    }

    prisma = new PrismaService({
      datasources: { db: { url: dbUrlTest } },
    } as any);

    rawPrisma = prisma as unknown as PrismaClient;
    await prisma.$connect();

    escrowService = buildEscrowService(prisma);
    refundTransaction = new RefundTransactionService(prisma);
    classifier = new PaymentGatewayErrorClassifierService();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  function buildEscrowService(prismaService: PrismaService): EscrowService {
    const eventEmitter = new EventEmitter2();
    const ledger = new LedgerService(prismaService);
    const outbox = new OutboxService(prismaService, eventEmitter);
    const wallet = new WalletService(prismaService, ledger, eventEmitter);
    const transaction = new EscrowTransactionService(prismaService);

    return new EscrowService(
      prismaService,
      ledger,
      outbox,
      wallet,
      transaction,
      new EscrowStateMachineService(),
      new EscrowEventsService(),
      new EscrowReleasePolicyService(),
      new EscrowRefundPolicyService(),
      new EscrowDisputePolicyService(),
    );
  }

  function createFakeProvider() {
    const calls: FakeProviderCall[] = [];
    const processed = new Map<string, any>();

    const provider = {
      providerName: PaymentProvider.PIX_INTERNAL,
      integrationMode: 'SIMULATED',
      supportedMethods: [PaymentMethodType.PIX],
      validateWebhook: jest.fn(async () => true),
      refundPayment: jest.fn(
        async (
          paymentId: string,
          providerTransactionId: string,
          amount: Prisma.Decimal,
          metadata?: { refundId?: string; idempotencyKey?: string },
        ) => {
          calls.push({
            paymentId,
            providerTransactionId,
            amount: new Prisma.Decimal(amount),
            metadata,
          });

          const key = metadata?.idempotencyKey ?? `fallback:${metadata?.refundId ?? paymentId}`;
          const cached = processed.get(key);
          if (cached) return cached;

          const result = {
            success: true,
            status: PaymentStatus.REFUNDED,
            providerTransactionId: `REF-${key}`,
          };
          processed.set(key, result);
          return result;
        },
      ),
    };

    return { provider, calls, processed };
  }

  function buildExecutionService(options?: {
    provider?: any;
    timeout?: any;
    transaction?: any;
    escrow?: any;
  }) {
    const fake = options?.provider ? null : createFakeProvider();
    const provider = options?.provider ?? fake!.provider;

    const factory = {
      getByType: jest.fn(() => provider),
    };

    const timeout =
      options?.timeout ??
      ({
        invoke: jest.fn(async (_provider: any, operation: () => Promise<any>) => ({
          result: await operation(),
          durationMs: 1,
          timeoutMs: 1000,
        })),
      } as any);

    const service = new RefundProviderExecutionService(
      (options?.transaction ?? refundTransaction) as any,
      factory as any,
      timeout as any,
      classifier,
      (options?.escrow ?? escrowService) as any,
    );

    return {
      service,
      provider,
      calls: fake?.calls,
      factory,
      timeout,
    };
  }

  function buildWebhookStack() {
    const built = buildExecutionService();
    const factory = { getByType: jest.fn(() => built.provider) };
    const webhook = new RefundProviderWebhookService(prisma, factory as any, built.service);
    const reconciliation = new RefundReconciliationService(prisma, built.service);
    return { ...built, webhook, reconciliation, factory };
  }

  async function forceStale(refundId: string) {
    await rawPrisma.refund.update({
      where: { id: refundId },
      data: { updatedAt: new Date(Date.now() - 120_000) },
    });
  }

  async function seedDomain(total = '100.00'): Promise<SeededRefundDomain> {
    const seed = crypto.randomUUID();
    const short = seed.replace(/-/g, '').slice(0, 20);
    const totalAmount = new Prisma.Decimal(total);

    const currency = await rawPrisma.currency.create({
      data: {
        code: `R${short.slice(0, 16)}`,
        name: `Refund Test Currency ${short}`,
        symbol: 'T',
        decimals: 2,
      },
    });

    const country = await rawPrisma.country.create({
      data: {
        code: `RC${short.slice(0, 16)}`,
        name: `Refund Test Country ${short}`,
        flag: '🏳️',
        phonePrefix: `+${short.slice(0, 5)}`,
      },
    });

    const buyer = await rawPrisma.user.create({
      data: {
        firstName: 'Buyer',
        lastName: `Refund ${short}`,
        email: `refund-buyer-${seed}@integration.test`,
        phone: `24571${short}`,
        phoneCode: '+245',
        passwordHash: 'integration-test-hash',
        countryId: country.id,
        preferredCurrencyId: currency.id,
      },
    });

    const sellerUser = await rawPrisma.user.create({
      data: {
        firstName: 'Seller',
        lastName: `Refund ${short}`,
        email: `refund-seller-${seed}@integration.test`,
        phone: `24581${short}`,
        phoneCode: '+245',
        passwordHash: 'integration-test-hash',
        countryId: country.id,
        preferredCurrencyId: currency.id,
      },
    });

    const seller = await rawPrisma.sellerProfile.create({
      data: {
        userId: sellerUser.id,
        legalName: `Refund Seller ${short}`,
        tradeName: `Refund Seller ${short}`,
        countryId: country.id,
        status: SellerStatus.VERIFIED,
      },
    });

    const store = await rawPrisma.store.create({
      data: {
        sellerId: seller.id,
        countryId: country.id,
        name: `Refund Store ${short}`,
        slug: `refund-store-${seed}`,
        status: StoreStatus.ACTIVE,
      },
    });

    const cart = await rawPrisma.cart.create({
      data: { userId: buyer.id, currencyId: currency.id },
    });

    const address = await rawPrisma.address.create({
      data: {
        userId: buyer.id,
        recipientName: 'Refund Buyer',
        phoneCode: '+245',
        phone: `991${short}`,
        countryId: country.id,
        region: 'Bissau',
        city: 'Bissau',
        street: 'Rua Refund Integration',
        number: '1',
        postalCode: '1000',
      } as any,
    });

    const checkout = await rawPrisma.checkoutSession.create({
      data: {
        userId: buyer.id,
        cartId: cart.id,
        addressId: address.id,
        currencyId: currency.id,
        payloadHash: `refund-${seed}`,
        itemsSnapshotJson: [],
        pricingSnapshotJson: {},
        shippingQuotesJson: [],
        estimatedTaxesJson: {},
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const orderGroup = await rawPrisma.orderGroup.create({
      data: {
        userId: buyer.id,
        checkoutSessionId: checkout.id,
        addressSnapshotJson: {},
        currencyId: currency.id,
        subtotal: totalAmount,
        discountAmount: new Prisma.Decimal(0),
        shippingAmount: new Prisma.Decimal(0),
        estimatedTaxAmount: new Prisma.Decimal(0),
        total: totalAmount,
        status: 'PAID',
      } as any,
    });

    const order = await rawPrisma.order.create({
      data: {
        orderNumber: `RFD-${seed}`,
        orderGroupId: orderGroup.id,
        userId: buyer.id,
        sellerId: seller.id,
        storeId: store.id,
        currencyId: currency.id,
        subtotal: totalAmount,
        discountAmount: new Prisma.Decimal(0),
        shippingAmount: new Prisma.Decimal(0),
        estimatedTaxAmount: new Prisma.Decimal(0),
        total: totalAmount,
        status: OrderStatus.DELIVERED,
        shippingServiceCode: 'TEST',
        shippingServiceName: 'Refund Integration',
        estimatedDeliveryMinDays: 1,
        estimatedDeliveryMaxDays: 1,
        addressSnapshotJson: {},
        storeSnapshotJson: {},
        sellerSnapshotJson: {},
      },
    });

    const paymentIntent = await rawPrisma.paymentIntent.create({
      data: {
        orderGroupId: orderGroup.id,
        buyerId: buyer.id,
        amount: totalAmount,
        currencyId: currency.id,
        status: PaymentStatus.CAPTURED,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const payment = await rawPrisma.payment.create({
      data: {
        paymentIntentId: paymentIntent.id,
        orderGroupId: orderGroup.id,
        buyerId: buyer.id,
        amount: totalAmount,
        currencyId: currency.id,
        method: PaymentMethodType.PIX,
        provider: PaymentProvider.PIX_INTERNAL,
        providerReference: `provider-ref-${short}`,
        providerTransactionId: `provider-tx-${short}`,
        status: PaymentStatus.CAPTURED,
        paidAt: new Date(),
      },
    });

    const escrow = await rawPrisma.escrowAccount.create({
      data: {
        orderGroupId: orderGroup.id,
        orderId: order.id,
        sellerId: seller.id,
        buyerId: buyer.id,
        totalAmount,
        heldAmount: totalAmount,
        releasedAmount: new Prisma.Decimal(0),
        refundedAmount: new Prisma.Decimal(0),
        commissionAmount: totalAmount.mul('0.10'),
        currencyId: currency.id,
        status: EscrowStatus.HELD,
        disputeDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      buyerId: buyer.id,
      sellerId: seller.id,
      orderId: order.id,
      orderGroupId: orderGroup.id,
      paymentId: payment.id,
      escrowId: escrow.id,
      currencyId: currency.id,
      totalAmount,
    };
  }

  async function createRefund(
    seed: SeededRefundDomain,
    amount: string,
    status: RefundStatus = RefundStatus.PENDING,
  ) {
    return rawPrisma.refund.create({
      data: {
        paymentId: seed.paymentId,
        orderId: seed.orderId,
        buyerId: seed.buyerId,
        amount: new Prisma.Decimal(amount),
        currencyId: seed.currencyId,
        reason: 'Sprint 7.4.2.1 integration',
        status,
      },
    });
  }

  async function snapshot(seed: SeededRefundDomain) {
    const [payment, escrow, refunds, buyerWallet, ledgerEntries, refundOutbox] =
      await Promise.all([
        rawPrisma.payment.findUniqueOrThrow({ where: { id: seed.paymentId } }),
        rawPrisma.escrowAccount.findUniqueOrThrow({ where: { id: seed.escrowId } }),
        rawPrisma.refund.findMany({
          where: { paymentId: seed.paymentId },
          orderBy: { createdAt: 'asc' },
        }),
        rawPrisma.wallet.findUnique({ where: { userId: seed.buyerId } }),
        rawPrisma.ledgerEntry.findMany({
          where: {
            referenceType: 'EscrowAccount',
            referenceId: seed.escrowId,
          },
        }),
        rawPrisma.outboxEvent.findMany({
          where: { aggregateType: 'Refund' },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    return { payment, escrow, refunds, buyerWallet, ledgerEntries, refundOutbox };
  }

  it('1. replay sequencial do mesmo eventId retorna cache e não duplica refund', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '100.00', RefundStatus.PROCESSING);
    const stack = buildWebhookStack();
    const eventId = `evt-replay-${refund.id}`;
    const payload = { refundId: refund.id, status: 'succeeded' };

    const first = await stack.webhook.process('PIX_INTERNAL', eventId, 'refund.completed', { authorization: 'Bearer sensitive-token' }, payload, 'secret-signature');
    const second = await stack.webhook.process('PIX_INTERNAL', eventId, 'refund.completed', { authorization: 'Bearer sensitive-token' }, payload, 'secret-signature');

    expect(first.alreadyProcessed).toBe(false);
    expect(second.alreadyProcessed).toBe(true);

    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(state.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(state.escrow.refundedAmount.eq('100.00')).toBe(true);

    const rows = await rawPrisma.webhookEvent.findMany({ where: { provider: PaymentProvider.PIX_INTERNAL, eventId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('PROCESSED');
    expect(rows[0].signature).toBe('[REDACTED]');
  });

  it('2. replay concorrente do mesmo eventId executa efeito financeiro uma única vez', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '100.00', RefundStatus.PROCESSING);
    const stack = buildWebhookStack();
    const eventId = `evt-concurrent-${refund.id}`;

    const settled = await Promise.allSettled([
      stack.webhook.process('PIX_INTERNAL', eventId, 'refund.completed', {}, { refundId: refund.id, status: 'succeeded' }, 'sig'),
      stack.webhook.process('PIX_INTERNAL', eventId, 'refund.completed', {}, { refundId: refund.id, status: 'succeeded' }, 'sig'),
    ]);

    expect(settled.filter((item) => item.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(state.escrow.refundedAmount.eq('100.00')).toBe(true);

    const walletTransactions = state.buyerWallet ? await rawPrisma.walletTransaction.findMany({ where: { walletId: state.buyerWallet.id } }) : [];
    expect(walletTransactions).toHaveLength(1);
    expect(await rawPrisma.webhookEvent.count({ where: { provider: PaymentProvider.PIX_INTERNAL, eventId } })).toBe(1);
  });

  it('3. pending seguido de completed mantém monotonicidade', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '55.00', RefundStatus.PROCESSING);
    const stack = buildWebhookStack();

    await stack.webhook.process('PIX_INTERNAL', `evt-pending-${refund.id}`, 'refund.pending', {}, { refundId: refund.id, status: 'processing' });
    expect((await rawPrisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe(RefundStatus.PROCESSING);

    await stack.webhook.process('PIX_INTERNAL', `evt-completed-${refund.id}`, 'refund.completed', {}, { refundId: refund.id, status: 'succeeded' });
    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(state.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(state.escrow.refundedAmount.eq('55.00')).toBe(true);
  });

  it('4. failed atrasado depois de COMPLETED não regride estado', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '100.00', RefundStatus.PROCESSING);
    const stack = buildWebhookStack();

    await stack.webhook.process('PIX_INTERNAL', `evt-success-${refund.id}`, 'refund.completed', {}, { refundId: refund.id, status: 'succeeded' });
    await stack.webhook.process('PIX_INTERNAL', `evt-late-failed-${refund.id}`, 'refund.failed', {}, { refundId: refund.id, status: 'failed', reason: 'late event' });

    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(state.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(state.escrow.refundedAmount.eq('100.00')).toBe(true);
  });

  it('5. assinatura inválida não persiste evento nem altera Refund', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '30.00', RefundStatus.PROCESSING);
    const stack = buildWebhookStack();
    stack.provider.validateWebhook.mockResolvedValueOnce(false);
    const eventId = `evt-invalid-${refund.id}`;

    await expect(stack.webhook.process('PIX_INTERNAL', eventId, 'refund.completed', {}, { refundId: refund.id, status: 'succeeded' }, 'invalid')).rejects.toBeDefined();
    expect((await rawPrisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe(RefundStatus.PROCESSING);
    expect(await rawPrisma.webhookEvent.count({ where: { provider: PaymentProvider.PIX_INTERNAL, eventId } })).toBe(0);
  });

  it('6. provider divergente marca WebhookEvent FAILED e não altera Refund', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '40.00', RefundStatus.PROCESSING);
    const stack = buildWebhookStack();
    const eventId = `evt-mismatch-${refund.id}`;
    const other = { ...stack.provider, providerName: PaymentProvider.ORANGE, validateWebhook: jest.fn(async () => true) };
    stack.factory.getByType.mockReturnValueOnce(other);

    await expect(stack.webhook.process('ORANGE', eventId, 'refund.completed', {}, { refundId: refund.id, status: 'succeeded' })).rejects.toBeDefined();
    expect((await rawPrisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe(RefundStatus.PROCESSING);
    const row = await rawPrisma.webhookEvent.findUniqueOrThrow({ where: { provider_eventId: { provider: PaymentProvider.ORANGE, eventId } } });
    expect(row.status).toBe('FAILED');
  });

  it('7. webhook completed vs retry concorrente converge sem double-refund', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '100.00', RefundStatus.PROCESSING);
    await forceStale(refund.id);
    const stack = buildWebhookStack();

    const settled = await Promise.allSettled([
      stack.webhook.process('PIX_INTERNAL', `evt-vs-retry-${refund.id}`, 'refund.completed', {}, { refundId: refund.id, status: 'succeeded' }),
      stack.service.retry(refund.id),
    ]);
    expect(settled.filter((item) => item.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);

    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(state.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(state.escrow.refundedAmount.eq('100.00')).toBe(true);
    const walletTransactions = state.buyerWallet ? await rawPrisma.walletTransaction.findMany({ where: { walletId: state.buyerWallet.id } }) : [];
    expect(walletTransactions).toHaveLength(1);
  });

  it('8. reconciliation em lote converge PROCESSING antigos', async () => {
    const seedA = await seedDomain();
    const refundA = await createRefund(seedA, '35.00', RefundStatus.PROCESSING);
    await forceStale(refundA.id);
    const seedB = await seedDomain();
    const refundB = await createRefund(seedB, '60.00', RefundStatus.PROCESSING);
    await forceStale(refundB.id);
    const stack = buildWebhookStack();

    const previous = process.env.REFUND_RECONCILIATION_STALE_MS;
    process.env.REFUND_RECONCILIATION_STALE_MS = '60000';
    let result;
    try { result = await stack.reconciliation.reconcileStaleProcessing(50); }
    finally {
      if (previous === undefined) delete process.env.REFUND_RECONCILIATION_STALE_MS;
      else process.env.REFUND_RECONCILIATION_STALE_MS = previous;
    }

    expect(result.scanned).toBeGreaterThanOrEqual(2);
    expect(result.completed).toBeGreaterThanOrEqual(2);
    const [stateA, stateB] = await Promise.all([snapshot(seedA), snapshot(seedB)]);
    expect(stateA.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(stateB.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(stateA.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(stateB.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
  });
});
