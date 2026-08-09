import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LedgerAccountType,
  PayoutStatus,
  Prisma,
  PrismaClient,
  SellerSettlementStatus,
  SellerStatus,
  SettlementBatchStatus,
  WalletStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { PayoutsService } from '../../src/modules/payouts/payouts.service';
import { PayoutEventsService } from '../../src/modules/payouts/services/payout-events.service';
import { PayoutReconciliationService } from '../../src/modules/payouts/services/payout-reconciliation.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { SettlementPayoutService } from '../../src/modules/settlements/settlement-payout.service';
import { SettlementsService } from '../../src/modules/settlements/settlements.service';
import { WalletTransactionService } from '../../src/modules/wallet/services/wallet-transaction.service';
import { WalletService } from '../../src/modules/wallet/wallet.service';

type SeededSettlement = {
  userId: string;
  sellerId: string;
  walletId: string;
  currencyId: string;
  batchId: string;
  settlementId: string;
  payoutAmount: Prisma.Decimal;
};

describe('Sprint 7.6.4 - Settlement Real PostgreSQL Concurrency & Payout Reconciliation', () => {
  jest.setTimeout(120000);

  const dbUrlTest = process.env.DATABASE_URL_TEST || '';

  let prisma: PrismaService;
  let raw: PrismaClient;
  let payoutsService: PayoutsService;
  let settlementPayoutService: SettlementPayoutService;

  beforeAll(async () => {
    if (!dbUrlTest) {
      throw new Error(
        'DATABASE_URL_TEST é obrigatória para a Sprint 7.6.4.',
      );
    }

    if (!dbUrlTest.includes('_test')) {
      throw new Error(
        `Segurança de Dados: DATABASE_URL_TEST ("${dbUrlTest}") deve conter "_test".`,
      );
    }

    prisma = new PrismaService({
      datasources: { db: { url: dbUrlTest } },
    } as any);
    raw = prisma as unknown as PrismaClient;
    await prisma.$connect();

    const ledgerService = new LedgerService(prisma);
    const eventEmitter = new EventEmitter2();
    const walletTransactionService =
      new WalletTransactionService(prisma);
    const walletService = new WalletService(
      prisma,
      ledgerService,
      eventEmitter,
      walletTransactionService,
    );
    const payoutEvents = new PayoutEventsService();
    const payoutReconciliation =
      new PayoutReconciliationService(prisma);

    payoutsService = new PayoutsService(
      prisma,
      walletService,
      walletTransactionService,
      payoutEvents,
      payoutReconciliation,
    );

    const settlementsService = new SettlementsService(prisma);

    settlementPayoutService = new SettlementPayoutService(
      prisma,
      settlementsService,
      payoutsService,
    );
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  async function seedSettlement(
    payoutAmount = '100.00',
    walletAmount = payoutAmount,
  ): Promise<SeededSettlement> {
    const seed = crypto.randomUUID().replace(/-/g, '');
    const short = seed.slice(0, 12);

    const currency = await raw.currency.create({
      data: {
        code: `S${short.slice(0, 5)}`.toUpperCase(),
        name: `Settlement Test Currency ${short}`,
        symbol: 'T',
        decimals: 2,
      },
    });

    const country = await raw.country.create({
      data: {
        code: `R${short.slice(0, 5)}`.toUpperCase(),
        name: `Settlement Test Country ${short}`,
        flag: 'TEST',
        phonePrefix: `+7${short.slice(0, 5)}`,
        defaultCurrencyId: currency.id,
      },
    });

    const user = await raw.user.create({
      data: {
        firstName: 'Settlement',
        lastName: `Test ${short}`,
        email: `settlement-${short}@integration.test`,
        phone: `+997${short}`,
        phoneCode: '+997',
        passwordHash: 'integration-test-only',
        preferredCurrencyId: currency.id,
      },
    });

    const seller = await raw.sellerProfile.create({
      data: {
        userId: user.id,
        legalName: `Settlement Seller ${short}`,
        tradeName: `Settlement Seller ${short}`,
        status: SellerStatus.VERIFIED,
        countryId: country.id,
      },
    });

    const wallet = await raw.wallet.create({
      data: {
        userId: user.id,
        currencyId: currency.id,
        balanceAvailable: new Prisma.Decimal(walletAmount),
        balanceBlocked: new Prisma.Decimal(0),
        status: WalletStatus.ACTIVE,
      },
    });

    const periodStart = new Date(Date.now() - 60 * 60 * 1000);
    const periodEnd = new Date(Date.now() + 60 * 60 * 1000);

    const batch = await raw.settlementBatch.create({
      data: {
        periodStart,
        periodEnd,
        currencyId: currency.id,
        status: SettlementBatchStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    const amount = new Prisma.Decimal(payoutAmount);

    const settlement = await raw.sellerSettlement.create({
      data: {
        batchId: batch.id,
        sellerId: seller.id,
        currencyId: currency.id,
        grossAmount: amount,
        platformFee: new Prisma.Decimal(0),
        adjustments: new Prisma.Decimal(0),
        payoutAmount: amount,
        status: SellerSettlementStatus.READY,
        statementJson: {
          grossAmount: amount.toFixed(4),
          platformFee: '0.0000',
          adjustments: '0.0000',
          payoutAmount: amount.toFixed(4),
        },
      },
    });

    return {
      userId: user.id,
      sellerId: seller.id,
      walletId: wallet.id,
      currencyId: currency.id,
      batchId: batch.id,
      settlementId: settlement.id,
      payoutAmount: amount,
    };
  }

  async function snapshot(seed: SeededSettlement) {
    const settlement =
      await raw.sellerSettlement.findUniqueOrThrow({
        where: { id: seed.settlementId },
      });

    const payouts = await raw.payout.findMany({
      where: { sellerId: seed.sellerId },
      orderBy: { createdAt: 'asc' },
    });

    const wallet = await raw.wallet.findUniqueOrThrow({
      where: { id: seed.walletId },
    });

    const payoutId = settlement.payoutId;

    const [walletTransactions, ledgerEntries, outboxEvents] =
      payoutId
        ? await Promise.all([
            raw.walletTransaction.findMany({
              where: {
                referenceType: 'Payout',
                referenceId: payoutId,
              },
              orderBy: { createdAt: 'asc' },
            }),
            raw.ledgerEntry.findMany({
              where: {
                referenceType: 'Payout',
                referenceId: payoutId,
              },
              orderBy: { createdAt: 'asc' },
            }),
            raw.outboxEvent.findMany({
              where: {
                aggregateType: 'Payout',
                aggregateId: payoutId,
              },
              orderBy: { createdAt: 'asc' },
            }),
          ])
        : [[], [], []];

    return {
      settlement,
      payouts,
      wallet,
      walletTransactions,
      ledgerEntries,
      outboxEvents,
    };
  }

  it('1. request vs request: cria exatamente um payout e uma única reserva', async () => {
    const seed = await seedSettlement();

    const results = await Promise.allSettled([
      settlementPayoutService.requestPayout(
        seed.batchId,
        seed.sellerId,
      ),
      settlementPayoutService.requestPayout(
        seed.batchId,
        seed.sellerId,
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled')
        .length,
    ).toBeGreaterThanOrEqual(1);

    const state = await snapshot(seed);

    expect(state.payouts).toHaveLength(1);
    expect(state.settlement.payoutId).toBe(
      state.payouts[0].id,
    );
    expect(state.settlement.status).toBe(
      SellerSettlementStatus.PAYOUT_PENDING,
    );
    expect(
      state.wallet.balanceAvailable.eq(0),
    ).toBe(true);
    expect(
      state.wallet.balanceBlocked.eq(seed.payoutAmount),
    ).toBe(true);
    expect(state.walletTransactions).toHaveLength(1);
    expect(
      state.outboxEvents.filter(
        (event) => event.eventType === 'payout.requested',
      ),
    ).toHaveLength(1);
  });

  it('2. request repetido após vínculo é idempotente e não cria nova reserva', async () => {
    const seed = await seedSettlement();

    const first =
      await settlementPayoutService.requestPayout(
        seed.batchId,
        seed.sellerId,
      );

    const second =
      await settlementPayoutService.requestPayout(
        seed.batchId,
        seed.sellerId,
      );

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);

    const state = await snapshot(seed);

    expect(state.payouts).toHaveLength(1);
    expect(state.walletTransactions).toHaveLength(1);
    expect(
      state.wallet.balanceBlocked.eq(seed.payoutAmount),
    ).toBe(true);
  });

  it('3. process vs process: payout e settlement convergem sem double debit', async () => {
    const seed = await seedSettlement();

    await settlementPayoutService.requestPayout(
      seed.batchId,
      seed.sellerId,
    );

    await Promise.allSettled([
      settlementPayoutService.processPayout(
        seed.settlementId,
      ),
      settlementPayoutService.processPayout(
        seed.settlementId,
      ),
    ]);

    const state = await snapshot(seed);

    expect(state.payouts).toHaveLength(1);
    expect(state.payouts[0].status).toBe(PayoutStatus.PAID);
    expect(state.settlement.status).toBe(
      SellerSettlementStatus.SETTLED,
    );
    expect(state.settlement.settledAt).not.toBeNull();
    expect(state.wallet.balanceAvailable.eq(0)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
    expect(state.ledgerEntries).toHaveLength(1);
    expect(state.ledgerEntries[0].debitAccount).toBe(
      LedgerAccountType.SELLER_WALLET,
    );
    expect(state.ledgerEntries[0].creditAccount).toBe(
      LedgerAccountType.GATEWAY_CLEARING,
    );
    expect(
      state.outboxEvents.filter(
        (event) => event.eventType === 'payout.paid',
      ),
    ).toHaveLength(1);
  });

  it('4. falha real na reserva restaura settlement para READY e não deixa payout órfão', async () => {
    const seed = await seedSettlement('100.00', '50.00');

    await expect(
      settlementPayoutService.requestPayout(
        seed.batchId,
        seed.sellerId,
      ),
    ).rejects.toBeDefined();

    const state = await snapshot(seed);

    expect(state.payouts).toHaveLength(0);
    expect(state.settlement.status).toBe(
      SellerSettlementStatus.READY,
    );
    expect(state.settlement.payoutId).toBeNull();
    expect(state.settlement.payoutRequestedAt).toBeNull();
    expect(state.wallet.balanceAvailable.eq('50.00')).toBe(true);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
  });

  it('5. payout FAILED devolve saldo e reconcile marca settlement FAILED', async () => {
    const seed = await seedSettlement();

    const requested =
      await settlementPayoutService.requestPayout(
        seed.batchId,
        seed.sellerId,
      );

    await payoutsService.failPayout(
      requested.payout!.id,
      'SETTLEMENT_INTEGRATION_FAILURE',
    );

    const reconciliation =
      await settlementPayoutService.reconcilePayout(
        seed.settlementId,
      );

    expect(reconciliation.consistent).toBe(true);
    expect(reconciliation.action).toBe('MARKED_FAILED');

    const state = await snapshot(seed);

    expect(state.payouts[0].status).toBe(
      PayoutStatus.FAILED,
    );
    expect(state.settlement.status).toBe(
      SellerSettlementStatus.FAILED,
    );
    expect(
      state.wallet.balanceAvailable.eq(seed.payoutAmount),
    ).toBe(true);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
    expect(state.ledgerEntries).toHaveLength(0);
  });

  it('6. payout CANCELLED devolve saldo e reconcile marca settlement FAILED', async () => {
    const seed = await seedSettlement();

    const requested =
      await settlementPayoutService.requestPayout(
        seed.batchId,
        seed.sellerId,
      );

    await payoutsService.cancelPayout(
      seed.userId,
      requested.payout!.id,
    );

    const reconciliation =
      await settlementPayoutService.reconcilePayout(
        seed.settlementId,
      );

    expect(reconciliation.consistent).toBe(true);
    expect(reconciliation.action).toBe('MARKED_FAILED');

    const state = await snapshot(seed);

    expect(state.payouts[0].status).toBe(
      PayoutStatus.CANCELLED,
    );
    expect(state.settlement.status).toBe(
      SellerSettlementStatus.FAILED,
    );
    expect(
      state.wallet.balanceAvailable.eq(seed.payoutAmount),
    ).toBe(true);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
  });

  it('7. recovery: payout PAID com settlement ainda pendente converge para SETTLED', async () => {
    const seed = await seedSettlement();

    const requested =
      await settlementPayoutService.requestPayout(
        seed.batchId,
        seed.sellerId,
      );

    await payoutsService.processPayout(
      requested.payout!.id,
    );

    const before =
      await raw.sellerSettlement.findUniqueOrThrow({
        where: { id: seed.settlementId },
      });

    expect(before.status).toBe(
      SellerSettlementStatus.PAYOUT_PENDING,
    );

    const reconciliation =
      await settlementPayoutService.reconcilePayout(
        seed.settlementId,
      );

    expect(reconciliation.consistent).toBe(true);
    expect(reconciliation.action).toBe('MARKED_SETTLED');

    const state = await snapshot(seed);

    expect(state.payouts[0].status).toBe(PayoutStatus.PAID);
    expect(state.settlement.status).toBe(
      SellerSettlementStatus.SETTLED,
    );
    expect(state.ledgerEntries).toHaveLength(1);
  });

  it('8. valor do payout vinculado é exatamente o payoutAmount do settlement', async () => {
    const seed = await seedSettlement('92.95');

    const requested =
      await settlementPayoutService.requestPayout(
        seed.batchId,
        seed.sellerId,
      );

    expect(
      new Prisma.Decimal(requested.payout!.amount).eq(
        seed.payoutAmount,
      ),
    ).toBe(true);

    const state = await snapshot(seed);

    expect(state.payouts).toHaveLength(1);
    expect(
      state.payouts[0].amount.eq(seed.payoutAmount),
    ).toBe(true);
    expect(
      state.wallet.balanceBlocked.eq(seed.payoutAmount),
    ).toBe(true);
  });
});
