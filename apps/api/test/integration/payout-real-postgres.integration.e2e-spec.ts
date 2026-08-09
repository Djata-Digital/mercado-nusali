import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LedgerAccountType,
  PayoutStatus,
  Prisma,
  PrismaClient,
  SellerStatus,
  WalletStatus,
  WalletTransactionType,
} from '@prisma/client';
import { execSync } from 'child_process';
import * as crypto from 'crypto';

import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { PayoutsService } from '../../src/modules/payouts/payouts.service';
import { PayoutEventsService } from '../../src/modules/payouts/services/payout-events.service';
import { PayoutReconciliationService } from '../../src/modules/payouts/services/payout-reconciliation.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { WalletTransactionService } from '../../src/modules/wallet/services/wallet-transaction.service';
import { WalletService } from '../../src/modules/wallet/wallet.service';

type SeededPayout = {
  userId: string;
  sellerId: string;
  walletId: string;
  currencyId: string;
  payoutId: string;
  amount: Prisma.Decimal;
};

describe('Sprint 7.3.5 - Payout Real PostgreSQL Concurrency & Recovery', () => {
  jest.setTimeout(120000);

  const dbUrlTest = process.env.DATABASE_URL_TEST || '';

  let prisma: PrismaService;
  let rawPrisma: PrismaClient;
  let walletService: WalletService;
  let walletTransactionService: WalletTransactionService;
  let payoutEvents: PayoutEventsService;
  let reconciliation: PayoutReconciliationService;
  let payoutsService: PayoutsService;

  beforeAll(async () => {
    if (!dbUrlTest) {
      throw new Error(
        'DATABASE_URL_TEST é obrigatória para a Sprint 7.3.5. Use um PostgreSQL isolado cujo nome contenha "_test".',
      );
    }

    if (!dbUrlTest.includes('_test')) {
      throw new Error(
        `Segurança de Dados: DATABASE_URL_TEST ("${dbUrlTest}") deve conter "_test" no nome do banco.`,
      );
    }

    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: dbUrlTest },
      stdio: 'pipe',
    });

    prisma = new PrismaService({
      datasources: { db: { url: dbUrlTest } },
    } as any);
    rawPrisma = prisma as unknown as PrismaClient;
    await prisma.$connect();

    const ledgerService = new LedgerService(prisma);
    const eventEmitter = new EventEmitter2();
    walletTransactionService = new WalletTransactionService(prisma);
    walletService = new WalletService(
      prisma,
      ledgerService,
      eventEmitter,
      walletTransactionService,
    );
    payoutEvents = new PayoutEventsService();
    reconciliation = new PayoutReconciliationService(prisma);
    payoutsService = new PayoutsService(
      prisma,
      walletService,
      walletTransactionService,
      payoutEvents,
      reconciliation,
    );
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  async function seedRequestedPayout(amount = '100.00'): Promise<SeededPayout> {
    const id = crypto.randomUUID().replace(/-/g, '');
    const short = id.slice(0, 12);

    const currency = await rawPrisma.currency.create({
      data: {
        code: `P${short.slice(0, 5)}`.toUpperCase(),
        name: `Payout Test Currency ${short}`,
        symbol: 'T',
        decimals: 2,
      },
    });

    const country = await rawPrisma.country.create({
      data: {
        code: `Q${short.slice(0, 5)}`.toUpperCase(),
        name: `Payout Test Country ${short}`,
        flag: 'TEST',
        phonePrefix: `+8${short.slice(0, 5)}`,
        defaultCurrencyId: currency.id,
      },
    });

    const user = await rawPrisma.user.create({
      data: {
        firstName: 'Payout',
        lastName: `Test ${short}`,
        email: `payout-${short}@integration.test`,
        phone: `+998${short}`,
        phoneCode: '+998',
        passwordHash: 'integration-test-only',
        preferredCurrencyId: currency.id,
      },
    });

    const seller = await rawPrisma.sellerProfile.create({
      data: {
        userId: user.id,
        legalName: `Seller ${short}`,
        tradeName: `Seller ${short}`,
        status: SellerStatus.VERIFIED,
        countryId: country.id,
      },
    });

    const wallet = await rawPrisma.wallet.create({
      data: {
        userId: user.id,
        currencyId: currency.id,
        balanceAvailable: new Prisma.Decimal(amount),
        balanceBlocked: new Prisma.Decimal(0),
        status: WalletStatus.ACTIVE,
      },
    });

    const payout = await payoutsService.requestPayout(
      user.id,
      new Prisma.Decimal(amount),
      currency.id,
      'BANK_TRANSFER',
    );

    return {
      userId: user.id,
      sellerId: seller.id,
      walletId: wallet.id,
      currencyId: currency.id,
      payoutId: payout.id,
      amount: new Prisma.Decimal(amount),
    };
  }

  async function snapshot(seed: SeededPayout) {
    const [payout, wallet, walletTransactions, ledgerEntries, outboxEvents] =
      await Promise.all([
        rawPrisma.payout.findUniqueOrThrow({ where: { id: seed.payoutId } }),
        rawPrisma.wallet.findUniqueOrThrow({ where: { id: seed.walletId } }),
        rawPrisma.walletTransaction.findMany({
          where: { referenceType: 'Payout', referenceId: seed.payoutId },
          orderBy: { createdAt: 'asc' },
        }),
        rawPrisma.ledgerEntry.findMany({
          where: { referenceType: 'Payout', referenceId: seed.payoutId },
          orderBy: { createdAt: 'asc' },
        }),
        rawPrisma.outboxEvent.findMany({
          where: { aggregateType: 'Payout', aggregateId: seed.payoutId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

    return { payout, wallet, walletTransactions, ledgerEntries, outboxEvents };
  }

  function countType(
    transactions: Array<{ type: WalletTransactionType }>,
    type: WalletTransactionType,
  ) {
    return transactions.filter((item) => item.type === type).length;
  }

  it('1. process vs process: payout é debitado exatamente uma vez', async () => {
    const seed = await seedRequestedPayout();

    await Promise.allSettled([
      payoutsService.processPayout(seed.payoutId),
      payoutsService.processPayout(seed.payoutId),
    ]);

    const state = await snapshot(seed);
    expect(state.payout.status).toBe(PayoutStatus.PAID);
    expect(state.wallet.balanceAvailable.eq(0)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
    expect(countType(state.walletTransactions, WalletTransactionType.ESCROW_HOLD)).toBe(1);
    expect(countType(state.walletTransactions, WalletTransactionType.WITHDRAW)).toBe(1);
    expect(state.ledgerEntries).toHaveLength(1);
    expect(state.ledgerEntries[0].debitAccount).toBe(LedgerAccountType.SELLER_WALLET);
    expect(state.ledgerEntries[0].creditAccount).toBe(LedgerAccountType.GATEWAY_CLEARING);
    expect(state.outboxEvents.filter((event) => event.eventType === 'payout.paid')).toHaveLength(1);
  });

  it('2. process vs cancel: o saldo reservado só pode ter um destino', async () => {
    const seed = await seedRequestedPayout();

    await Promise.allSettled([
      payoutsService.processPayout(seed.payoutId),
      payoutsService.cancelPayout(seed.userId, seed.payoutId),
    ]);

    const state = await snapshot(seed);
    expect([PayoutStatus.PAID, PayoutStatus.CANCELLED]).toContain(state.payout.status);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);

    if (state.payout.status === PayoutStatus.PAID) {
      expect(state.wallet.balanceAvailable.eq(0)).toBe(true);
      expect(countType(state.walletTransactions, WalletTransactionType.WITHDRAW)).toBe(1);
      expect(state.ledgerEntries).toHaveLength(1);
    } else {
      expect(state.wallet.balanceAvailable.eq(seed.amount)).toBe(true);
      expect(countType(state.walletTransactions, WalletTransactionType.WITHDRAW)).toBe(0);
      expect(state.ledgerEntries).toHaveLength(0);
    }
  });

  it('3. process vs fail: PAID e FAILED são mutuamente exclusivos', async () => {
    const seed = await seedRequestedPayout();

    await Promise.allSettled([
      payoutsService.processPayout(seed.payoutId),
      payoutsService.failPayout(seed.payoutId, 'CONCURRENT_PROVIDER_FAILURE'),
    ]);

    const state = await snapshot(seed);
    expect([PayoutStatus.PAID, PayoutStatus.FAILED]).toContain(state.payout.status);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);

    if (state.payout.status === PayoutStatus.PAID) {
      expect(state.wallet.balanceAvailable.eq(0)).toBe(true);
      expect(countType(state.walletTransactions, WalletTransactionType.WITHDRAW)).toBe(1);
      expect(state.ledgerEntries).toHaveLength(1);
    } else {
      expect(state.wallet.balanceAvailable.eq(seed.amount)).toBe(true);
      expect(countType(state.walletTransactions, WalletTransactionType.WITHDRAW)).toBe(0);
      expect(state.ledgerEntries).toHaveLength(0);
    }
  });

  it('4. cancel vs cancel: devolve saldo uma única vez', async () => {
    const seed = await seedRequestedPayout();

    await Promise.allSettled([
      payoutsService.cancelPayout(seed.userId, seed.payoutId),
      payoutsService.cancelPayout(seed.userId, seed.payoutId),
    ]);

    const state = await snapshot(seed);
    expect(state.payout.status).toBe(PayoutStatus.CANCELLED);
    expect(state.wallet.balanceAvailable.eq(seed.amount)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
    expect(countType(state.walletTransactions, WalletTransactionType.ADJUSTMENT)).toBe(1);
    expect(state.outboxEvents.filter((event) => event.eventType === 'payout.cancelled')).toHaveLength(1);
  });

  it('5. fail vs fail: devolve saldo uma única vez', async () => {
    const seed = await seedRequestedPayout();

    await Promise.allSettled([
      payoutsService.failPayout(seed.payoutId, 'FAIL_A'),
      payoutsService.failPayout(seed.payoutId, 'FAIL_B'),
    ]);

    const state = await snapshot(seed);
    expect(state.payout.status).toBe(PayoutStatus.FAILED);
    expect(state.wallet.balanceAvailable.eq(seed.amount)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
    expect(countType(state.walletTransactions, WalletTransactionType.ADJUSTMENT)).toBe(1);
    expect(state.outboxEvents.filter((event) => event.eventType === 'payout.failed')).toHaveLength(1);
  });

  it('6. recovery: payout preso em PROCESSING pode falhar com devolução integral', async () => {
    const seed = await seedRequestedPayout();

    await rawPrisma.payout.update({
      where: { id: seed.payoutId },
      data: { status: PayoutStatus.PROCESSING },
    });

    await payoutsService.failPayout(seed.payoutId, 'STALE_PROCESSING_RECOVERY');

    const state = await snapshot(seed);
    expect(state.payout.status).toBe(PayoutStatus.FAILED);
    expect(state.wallet.balanceAvailable.eq(seed.amount)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
    expect(countType(state.walletTransactions, WalletTransactionType.WITHDRAW)).toBe(0);
    expect(state.ledgerEntries).toHaveLength(0);
    expect(state.outboxEvents.filter((event) => event.eventType === 'payout.failed')).toHaveLength(1);
  });

  it('7. falha do Outbox durante PAID faz rollback real do débito e do Ledger', async () => {
    const seed = await seedRequestedPayout();

    const failingEvents = {
      enqueue: async (
        tx: Prisma.TransactionClient,
        payoutId: string,
        eventType: string,
        payload: Prisma.InputJsonValue,
      ) => {
        if (eventType === 'payout.paid') {
          throw new Error('OUTBOX_FAILURE_INTEGRATION_TEST');
        }
        return payoutEvents.enqueue(tx, payoutId, eventType, payload);
      },
    } as PayoutEventsService;

    const failingService = new PayoutsService(
      prisma,
      walletService,
      walletTransactionService,
      failingEvents,
      reconciliation,
    );

    await expect(failingService.processPayout(seed.payoutId)).rejects.toThrow(
      'OUTBOX_FAILURE_INTEGRATION_TEST',
    );

    const state = await snapshot(seed);
    expect(state.payout.status).toBe(PayoutStatus.CREATED);
    expect(state.wallet.balanceAvailable.eq(0)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(seed.amount)).toBe(true);
    expect(countType(state.walletTransactions, WalletTransactionType.WITHDRAW)).toBe(0);
    expect(state.ledgerEntries).toHaveLength(0);
    expect(state.outboxEvents.filter((event) => event.eventType === 'payout.paid')).toHaveLength(0);
  });

  it('8. reconciliação confirma payout PAID íntegro após concorrência real', async () => {
    const seed = await seedRequestedPayout();

    await Promise.allSettled([
      payoutsService.processPayout(seed.payoutId),
      payoutsService.processPayout(seed.payoutId),
    ]);

    const result = await reconciliation.reconcileOne(seed.payoutId);
    expect(result.status).toBe(PayoutStatus.PAID);
    expect(result.consistent).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.reservationCount).toBe(1);
    expect(result.payoutDebitCount).toBe(1);
    expect(result.ledgerCount).toBe(1);
  });
});
