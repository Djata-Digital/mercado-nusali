import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LedgerAccountType,
  Prisma,
  PrismaClient,
  WalletStatus,
} from '@prisma/client';
import { execSync } from 'child_process';
import * as crypto from 'crypto';

import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { WalletTransactionService } from '../../src/modules/wallet/services/wallet-transaction.service';
import { WalletService } from '../../src/modules/wallet/wallet.service';

type SeededWallet = {
  userId: string;
  walletId: string;
  currencyId: string;
  initialAvailable: Prisma.Decimal;
  initialBlocked: Prisma.Decimal;
};

describe('Sprint 7.3.3 - Wallet Real PostgreSQL Concurrency', () => {
  jest.setTimeout(120000);

  const dbUrlTest = process.env.DATABASE_URL_TEST || '';

  let prisma: PrismaService;
  let rawPrisma: PrismaClient;
  let walletService: WalletService;

  beforeAll(async () => {
    if (!dbUrlTest) {
      throw new Error(
        'DATABASE_URL_TEST é obrigatória para a Sprint 7.3.3. Use um PostgreSQL isolado cujo nome contenha "_test".',
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
    const walletTransactionService = new WalletTransactionService(prisma);

    walletService = new WalletService(
      prisma,
      ledgerService,
      eventEmitter,
      walletTransactionService,
    );
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  async function seedWallet(
    available = '100.00',
    blocked = '0.00',
  ): Promise<SeededWallet> {
    const id = crypto.randomUUID().replace(/-/g, '');
    const short = id.slice(0, 12);

    const currency = await rawPrisma.currency.create({
      data: {
        code: `W${short.slice(0, 5)}`.toUpperCase(),
        name: `Wallet Test Currency ${short}`,
        symbol: 'T',
        decimals: 2,
      },
    });

    const user = await rawPrisma.user.create({
      data: {
        firstName: 'Wallet',
        lastName: `Test ${short}`,
        email: `wallet-${short}@integration.test`,
        phone: `+999${short}`,
        phoneCode: '+999',
        passwordHash: 'integration-test-only',
        preferredCurrencyId: currency.id,
      },
    });

    const wallet = await rawPrisma.wallet.create({
      data: {
        userId: user.id,
        currencyId: currency.id,
        balanceAvailable: new Prisma.Decimal(available),
        balanceBlocked: new Prisma.Decimal(blocked),
        status: WalletStatus.ACTIVE,
      },
    });

    return {
      userId: user.id,
      walletId: wallet.id,
      currencyId: currency.id,
      initialAvailable: new Prisma.Decimal(available),
      initialBlocked: new Prisma.Decimal(blocked),
    };
  }

  async function snapshot(seed: SeededWallet) {
    const wallet = await rawPrisma.wallet.findUniqueOrThrow({
      where: { id: seed.walletId },
    });

    const transactions = await rawPrisma.walletTransaction.findMany({
      where: { walletId: seed.walletId },
      orderBy: { createdAt: 'asc' },
    });

    const ledgerEntries = await rawPrisma.ledgerEntry.findMany({
      where: {
        referenceType: 'WalletConcurrencyTest',
        referenceId: seed.walletId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { wallet, transactions, ledgerEntries };
  }

  function fulfilledCount(results: PromiseSettledResult<unknown>[]) {
    return results.filter((result) => result.status === 'fulfilled').length;
  }

  function assertNonNegative(wallet: {
    balanceAvailable: Prisma.Decimal;
    balanceBlocked: Prisma.Decimal;
  }) {
    expect(new Prisma.Decimal(wallet.balanceAvailable).gte(0)).toBe(true);
    expect(new Prisma.Decimal(wallet.balanceBlocked).gte(0)).toBe(true);
  }

  it('1. reserve vs reserve: duas reservas concorrentes nunca deixam saldo disponível negativo', async () => {
    const seed = await seedWallet('100.00', '0.00');

    const results = await Promise.allSettled([
      walletService.reserveBalance(
        seed.userId, 70, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Reserva concorrente A',
      ),
      walletService.reserveBalance(
        seed.userId, 70, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Reserva concorrente B',
      ),
    ]);

    const state = await snapshot(seed);

    expect(fulfilledCount(results)).toBe(1);
    expect(state.wallet.balanceAvailable.eq(30)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(70)).toBe(true);
    expect(state.transactions).toHaveLength(1);
    assertNonNegative(state.wallet);
    expect(state.wallet.balanceAvailable.add(state.wallet.balanceBlocked).eq(100)).toBe(true);
  });

  it('2. reserve vs withdraw: operações concorrentes não podem consumir os mesmos 80 disponíveis', async () => {
    const seed = await seedWallet('100.00', '0.00');

    const results = await Promise.allSettled([
      walletService.reserveBalance(
        seed.userId, 80, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Reserva contra saque',
      ),
      walletService.withdraw(
        seed.userId, 80, seed.currencyId, 'Saque contra reserva',
      ),
    ]);

    const state = await snapshot(seed);

    expect(fulfilledCount(results)).toBe(1);
    assertNonNegative(state.wallet);

    const total = state.wallet.balanceAvailable.add(state.wallet.balanceBlocked);

    if (state.wallet.balanceBlocked.eq(80)) {
      expect(state.wallet.balanceAvailable.eq(20)).toBe(true);
      expect(total.eq(100)).toBe(true);
    } else {
      expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
      expect(state.wallet.balanceAvailable.eq(20)).toBe(true);
      expect(total.eq(20)).toBe(true);
    }
  });

  it('3. capture vs release: o mesmo saldo bloqueado só pode ter um destino', async () => {
    const seed = await seedWallet('0.00', '100.00');

    const results = await Promise.allSettled([
      walletService.captureReservedBalance(
        seed.userId, 100, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Captura concorrente',
      ),
      walletService.releaseReservedBalance(
        seed.userId, 100, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Desbloqueio concorrente',
      ),
    ]);

    const state = await snapshot(seed);

    expect(fulfilledCount(results)).toBe(1);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
    assertNonNegative(state.wallet);

    if (state.wallet.balanceAvailable.eq(0)) {
      expect(state.ledgerEntries).toHaveLength(1);
      expect(state.ledgerEntries[0].debitAccount).toBe(LedgerAccountType.BUYER_WALLET);
      expect(state.ledgerEntries[0].creditAccount).toBe(LedgerAccountType.PLATFORM_ESCROW);
      expect(new Prisma.Decimal(state.ledgerEntries[0].amount).eq(100)).toBe(true);
    } else {
      expect(state.wallet.balanceAvailable.eq(100)).toBe(true);
      expect(state.ledgerEntries).toHaveLength(0);
    }
  });

  it('4. capture vs capture: duas capturas totais concorrentes nunca fazem double spend', async () => {
    const seed = await seedWallet('0.00', '100.00');

    const results = await Promise.allSettled([
      walletService.captureReservedBalance(
        seed.userId, 100, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Captura A',
      ),
      walletService.captureReservedBalance(
        seed.userId, 100, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Captura B',
      ),
    ]);

    const state = await snapshot(seed);

    expect(fulfilledCount(results)).toBe(1);
    expect(state.wallet.balanceAvailable.eq(0)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(0)).toBe(true);
    expect(state.ledgerEntries).toHaveLength(1);
    expect(new Prisma.Decimal(state.ledgerEntries[0].amount).eq(100)).toBe(true);
    assertNonNegative(state.wallet);
  });

  it('5. duas liberações parciais concorrentes preservam available + blocked', async () => {
    const seed = await seedWallet('20.00', '80.00');

    const results = await Promise.allSettled([
      walletService.releaseReservedBalance(
        seed.userId, 50, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Release parcial A',
      ),
      walletService.releaseReservedBalance(
        seed.userId, 50, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Release parcial B',
      ),
    ]);

    const state = await snapshot(seed);

    expect(fulfilledCount(results)).toBe(1);
    expect(state.wallet.balanceAvailable.eq(70)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(30)).toBe(true);
    expect(state.wallet.balanceAvailable.add(state.wallet.balanceBlocked).eq(100)).toBe(true);
    assertNonNegative(state.wallet);
  });

  it('6. reserva e desbloqueio preservam o total da Wallet sem criar Ledger financeiro', async () => {
    const seed = await seedWallet('100.00', '0.00');

    await walletService.reserveBalance(
      seed.userId, 60, seed.currencyId,
      'WalletConcurrencyTest', seed.walletId, 'Reserva invariantes',
    );

    await walletService.releaseReservedBalance(
      seed.userId, 25, seed.currencyId,
      'WalletConcurrencyTest', seed.walletId, 'Release invariantes',
    );

    const state = await snapshot(seed);

    expect(state.wallet.balanceAvailable.eq(65)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(35)).toBe(true);
    expect(state.wallet.balanceAvailable.add(state.wallet.balanceBlocked).eq(100)).toBe(true);
    expect(state.ledgerEntries).toHaveLength(0);
    expect(state.transactions).toHaveLength(2);
    assertNonNegative(state.wallet);
  });

  it('7. captura parcial reduz somente blocked e cria exatamente um lançamento no Ledger', async () => {
    const seed = await seedWallet('40.00', '60.00');

    await walletService.captureReservedBalance(
      seed.userId, 35, seed.currencyId,
      'WalletConcurrencyTest', seed.walletId, 'Captura parcial',
    );

    const state = await snapshot(seed);

    expect(state.wallet.balanceAvailable.eq(40)).toBe(true);
    expect(state.wallet.balanceBlocked.eq(25)).toBe(true);
    expect(state.ledgerEntries).toHaveLength(1);
    expect(new Prisma.Decimal(state.ledgerEntries[0].amount).eq(35)).toBe(true);
    expect(state.wallet.balanceAvailable.add(state.wallet.balanceBlocked).eq(65)).toBe(true);
    assertNonNegative(state.wallet);
  });

  it('8. sequência concorrente não viola os invariantes financeiros da Wallet', async () => {
    const seed = await seedWallet('150.00', '50.00');

    await Promise.allSettled([
      walletService.reserveBalance(
        seed.userId, 80, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Stress reserve',
      ),
      walletService.withdraw(
        seed.userId, 90, seed.currencyId, 'Stress withdraw',
      ),
      walletService.captureReservedBalance(
        seed.userId, 40, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Stress capture',
      ),
      walletService.releaseReservedBalance(
        seed.userId, 30, seed.currencyId,
        'WalletConcurrencyTest', seed.walletId, 'Stress release',
      ),
    ]);

    const state = await snapshot(seed);
    assertNonNegative(state.wallet);

    const ledgerCaptured = state.ledgerEntries.reduce(
      (sum, entry) => sum.add(entry.amount),
      new Prisma.Decimal(0),
    );

    expect(ledgerCaptured.gte(0)).toBe(true);
    expect(state.wallet.balanceAvailable.gte(0)).toBe(true);
    expect(state.wallet.balanceBlocked.gte(0)).toBe(true);
  });
});
