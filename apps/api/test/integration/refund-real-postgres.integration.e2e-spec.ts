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

describe('Sprint 7.4.2.1 - Refund Real PostgreSQL Concurrency & Recovery', () => {
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

  async function seedDomain(total = '100.00'): Promise<SeededRefundDomain> {
    const seed = crypto.randomUUID();
    const short = seed.replace(/-/g, '').slice(0, 10);
    const totalAmount = new Prisma.Decimal(total);

    const currency = await rawPrisma.currency.create({
      data: {
        code: `R${short.slice(0, 5)}`,
        name: `Refund Test Currency ${short}`,
        symbol: 'T',
        decimals: 2,
      },
    });

    const country = await rawPrisma.country.create({
      data: {
        code: `RC${short.slice(0, 5)}`,
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

  it('1. execute vs execute do mesmo Refund chama provider uma única vez', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '100.00');
    const built = buildExecutionService();

    const settled = await Promise.allSettled([
      built.service.execute(refund.id),
      built.service.execute(refund.id),
    ]);

    expect(
      settled.filter((result) => result.status === 'fulfilled').length,
    ).toBeGreaterThanOrEqual(1);
    expect(built.provider.refundPayment).toHaveBeenCalledTimes(1);

    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(state.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(state.escrow.refundedAmount.eq('100.00')).toBe(true);
    expect(state.escrow.heldAmount.eq(0)).toBe(true);
  });

  it('2. refund 70 vs refund 70 no Payment 100 nunca permite total 140', async () => {
    const seed = await seedDomain();
    const a = await createRefund(seed, '70.00');
    const b = await createRefund(seed, '70.00');
    const built = buildExecutionService();

    const settled = await Promise.allSettled([
      built.service.execute(a.id),
      built.service.execute(b.id),
    ]);

    const state = await snapshot(seed);
    const completed = state.refunds.filter(
      (refund) => refund.status === RefundStatus.COMPLETED,
    );
    const completedTotal = completed.reduce(
      (sum, refund) => sum.add(refund.amount),
      new Prisma.Decimal(0),
    );

    expect(completedTotal.lte(seed.totalAmount)).toBe(true);
    expect(completedTotal.eq('70.00')).toBe(true);
    expect(built.provider.refundPayment).toHaveBeenCalledTimes(1);
    expect(
      settled.some((result) => result.status === 'rejected'),
    ).toBe(true);
    expect(state.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
  });

  it('3. refund 60 vs refund 40 pode totalizar exatamente 100 e finalizar Payment como REFUNDED', async () => {
    const seed = await seedDomain();
    const a = await createRefund(seed, '60.00');
    const b = await createRefund(seed, '40.00');
    const built = buildExecutionService();

    const settled = await Promise.allSettled([
      built.service.execute(a.id),
      built.service.execute(b.id),
    ]);

    expect(
      settled.filter((result) => result.status === 'fulfilled').length,
    ).toBe(2);

    const state = await snapshot(seed);
    const completedTotal = state.refunds
      .filter((refund) => refund.status === RefundStatus.COMPLETED)
      .reduce(
        (sum, refund) => sum.add(refund.amount),
        new Prisma.Decimal(0),
      );

    expect(completedTotal.eq('100.00')).toBe(true);
    expect(state.payment.status).toBe(PaymentStatus.REFUNDED);
    expect(state.escrow.heldAmount.eq(0)).toBe(true);
    expect(state.escrow.refundedAmount.eq('100.00')).toBe(true);
    expect(built.provider.refundPayment).toHaveBeenCalledTimes(2);
  });

  it('4. refund parcial confirmado mantém Payment como PARTIALLY_REFUNDED', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '35.00');
    const built = buildExecutionService();

    await built.service.execute(refund.id);

    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(state.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(state.escrow.refundedAmount.eq('35.00')).toBe(true);
    expect(state.escrow.heldAmount.eq('65.00')).toBe(true);
  });

  it('5. timeout após provider aceitar reutiliza a mesma idempotency key no retry', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '40.00');
    const fake = createFakeProvider();
    const seenKeys: string[] = [];
    let invocation = 0;

    const timeout = {
      invoke: jest.fn(async (_provider: any, operation: () => Promise<any>) => {
        invocation += 1;
        const result = await operation();
        const lastCall = fake.calls[fake.calls.length - 1];
        seenKeys.push(lastCall.metadata?.idempotencyKey ?? '');

        if (invocation === 1) {
          throw new PaymentGatewayException(
            'PAYMENT_TIMEOUT',
            'Resposta do provider perdida após aceite.',
            true,
            504,
          );
        }

        return { result, durationMs: 1, timeoutMs: 1000 };
      }),
    };

    const built = buildExecutionService({
      provider: fake.provider,
      timeout,
    });

    await expect(built.service.execute(refund.id)).rejects.toBeInstanceOf(
      PaymentGatewayException,
    );

    const afterTimeout = await rawPrisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
    });
    expect(afterTimeout.status).toBe(RefundStatus.PROCESSING);

    const previousStale = process.env.REFUND_PROCESSING_STALE_MS;
    process.env.REFUND_PROCESSING_STALE_MS = '0';

    try {
      await built.service.retry(refund.id);
    } finally {
      if (previousStale === undefined) {
        delete process.env.REFUND_PROCESSING_STALE_MS;
      } else {
        process.env.REFUND_PROCESSING_STALE_MS = previousStale;
      }
    }

    expect(seenKeys).toEqual([
      `refund:${refund.id}`,
      `refund:${refund.id}`,
    ]);

    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(state.escrow.refundedAmount.eq('40.00')).toBe(true);
  });

  it('6. falha de refund.completed no Outbox faz rollback da finalização local', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '50.00');
    const built = buildExecutionService();

    // O Prisma TransactionClient possui delegates próprios; para garantir a falha
    // dentro da transação, usamos um RefundTransactionService compatível que envolve
    // apenas o delegate outboxEvent com Proxy.
    const failingTransaction = {
      run: async (operation: any) =>
        prisma.$transaction(
          async (tx: any) => {
            const proxiedTx = new Proxy(tx, {
              get(target, prop, receiver) {
                if (prop !== 'outboxEvent') {
                  return Reflect.get(target, prop, receiver);
                }

                return new Proxy(target.outboxEvent, {
                  get(outboxTarget, outboxProp, outboxReceiver) {
                    if (outboxProp !== 'create') {
                      return Reflect.get(outboxTarget, outboxProp, outboxReceiver);
                    }

                    return async (args: any) => {
                      if (args?.data?.eventType === 'refund.completed') {
                        throw new Error('forced refund.completed outbox failure');
                      }
                      return outboxTarget.create(args);
                    };
                  },
                });
              },
            });

            return operation(proxiedTx);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
    };

    const failing = buildExecutionService({
      provider: built.provider,
      transaction: failingTransaction,
    });

    await expect(failing.service.execute(refund.id)).rejects.toThrow(
      'forced refund.completed outbox failure',
    );

    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.PROCESSING);
    expect(state.payment.status).toBe(PaymentStatus.CAPTURED);
    expect(state.escrow.heldAmount.eq('100.00')).toBe(true);
    expect(state.escrow.refundedAmount.eq(0)).toBe(true);
    expect(state.buyerWallet).toBeNull();
    expect(state.ledgerEntries).toHaveLength(0);
  });

  it('7. reconciliation de PROCESSING antigo converge para COMPLETED', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '45.00', RefundStatus.PROCESSING);
    const built = buildExecutionService();

    // Torna o lease realmente antigo no PostgreSQL, em vez de depender de
    // REFUND_PROCESSING_STALE_MS=0. Isso evita flutuação de relógio entre
    // Node e PostgreSQL quando a suíte completa roda imediatamente após o INSERT.
    await rawPrisma.refund.update({
      where: { id: refund.id },
      data: { updatedAt: new Date(Date.now() - 120_000) },
    });

    await built.service.reconcile(refund.id);

    const state = await snapshot(seed);
    expect(state.refunds[0].status).toBe(RefundStatus.COMPLETED);
    expect(state.payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(state.escrow.refundedAmount.eq('45.00')).toBe(true);
  });

  it('8. COMPLETED é idempotente e nova execução não chama provider novamente', async () => {
    const seed = await seedDomain();
    const refund = await createRefund(seed, '25.00');
    const built = buildExecutionService();

    await built.service.execute(refund.id);
    const callsAfterFirst = built.provider.refundPayment.mock.calls.length;

    const second = await built.service.execute(refund.id);

    expect(second.status).toBe(RefundStatus.COMPLETED);
    expect(built.provider.refundPayment).toHaveBeenCalledTimes(callsAfterFirst);

    const state = await snapshot(seed);
    const completed = state.refunds.filter(
      (item) => item.status === RefundStatus.COMPLETED,
    );
    expect(completed).toHaveLength(1);
    expect(state.escrow.refundedAmount.eq('25.00')).toBe(true);
  });
});
