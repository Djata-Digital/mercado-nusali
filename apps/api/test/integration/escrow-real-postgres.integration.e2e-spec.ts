import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  EscrowStatus,
  OrderStatus,
  Prisma,
  PrismaClient,
  SellerStatus,
  StoreStatus,
} from '@prisma/client';
import { execSync } from 'child_process';
import * as crypto from 'crypto';

import { EscrowService } from '../../src/modules/escrow/escrow.service';
import { EscrowEventsService } from '../../src/modules/escrow/services/escrow-events.service';
import { EscrowReleasePolicyService } from '../../src/modules/escrow/services/escrow-release-policy.service';
import { EscrowRefundPolicyService } from '../../src/modules/escrow/services/escrow-refund-policy.service';
import { EscrowDisputePolicyService } from '../../src/modules/escrow/services/escrow-dispute-policy.service';
import { EscrowStateMachineService } from '../../src/modules/escrow/services/escrow-state-machine.service';
import { EscrowTransactionService } from '../../src/modules/escrow/services/escrow-transaction.service';
import { LedgerService } from '../../src/modules/ledger/ledger.service';
import { OutboxService } from '../../src/modules/outbox/outbox.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { WalletService } from '../../src/modules/wallet/wallet.service';

type SeededEscrow = {
  escrowId: string;
  orderId: string;
  sellerUserId: string;
  buyerUserId: string;
  currencyId: string;
  totalAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
};

describe('Sprint 7.2.4.1 - Escrow Refund/Release Real PostgreSQL Concurrency', () => {
  jest.setTimeout(120000);

  const dbUrlTest = process.env.DATABASE_URL_TEST || '';

  let prisma: PrismaService;
  let rawPrisma: PrismaClient;
  let escrowService: EscrowService;

  beforeAll(async () => {
    if (!dbUrlTest) {
      throw new Error(
        'DATABASE_URL_TEST é obrigatória para a Sprint 7.2.4.1. Use um banco PostgreSQL isolado cujo nome contenha "_test".',
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

    escrowService = buildEscrowService(prisma, new EscrowEventsService());
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  function buildEscrowService(
    prismaService: PrismaService,
    events: EscrowEventsService,
  ): EscrowService {
    const eventEmitter = new EventEmitter2();
    const ledgerService = new LedgerService(prismaService);
    const outboxService = new OutboxService(prismaService, eventEmitter);
    const walletService = new WalletService(
      prismaService,
      ledgerService,
      eventEmitter,
    );
    const transactionService = new EscrowTransactionService(prismaService);
    const stateMachine = new EscrowStateMachineService();
    const policy = new EscrowReleasePolicyService();
    const refundPolicy = new EscrowRefundPolicyService();
    const disputePolicy = new EscrowDisputePolicyService();

    return new EscrowService(
      prismaService,
      ledgerService,
      outboxService,
      walletService,
      transactionService,
      stateMachine,
      events,
      policy,
      refundPolicy,
      disputePolicy,
    );
  }

  async function seedEscrow(
    total = '100.00',
    commission = '10.00',
  ): Promise<SeededEscrow> {
    const seed = crypto.randomUUID();
    const short = seed.replace(/-/g, '').slice(0, 10);

    const currency = await rawPrisma.currency.create({
      data: {
        code: `E${short.slice(0, 5)}`,
        name: `Escrow Test Currency ${short}`,
        symbol: 'T',
        decimals: 2,
      },
    });

    const country = await rawPrisma.country.create({
      data: {
        code: `EC${short.slice(0, 5)}`,
        name: `Escrow Test Country ${short}`,
        flag: '🏳️',
        phonePrefix: `+${short.slice(0, 5)}`,
      },
    });

    const buyer = await rawPrisma.user.create({
      data: {
        firstName: 'Buyer',
        lastName: 'Escrow',
        email: `buyer-${seed}@integration.test`,
        phone: `2457${short}`,
        phoneCode: '+245',
        passwordHash: 'integration-test-hash',
        countryId: country.id,
        preferredCurrencyId: currency.id,
      },
    });

    const sellerUser = await rawPrisma.user.create({
      data: {
        firstName: 'Seller',
        lastName: 'Escrow',
        email: `seller-${seed}@integration.test`,
        phone: `2458${short}`,
        phoneCode: '+245',
        passwordHash: 'integration-test-hash',
        countryId: country.id,
        preferredCurrencyId: currency.id,
      },
    });

    const seller = await rawPrisma.sellerProfile.create({
      data: {
        userId: sellerUser.id,
        legalName: `Seller ${short}`,
        tradeName: `Seller ${short}`,
        countryId: country.id,
        status: SellerStatus.VERIFIED,
      },
    });

    const store = await rawPrisma.store.create({
      data: {
        sellerId: seller.id,
        countryId: country.id,
        name: `Escrow Store ${short}`,
        slug: `escrow-store-${seed}`,
        status: StoreStatus.ACTIVE,
      },
    });

    const cart = await rawPrisma.cart.create({
      data: { userId: buyer.id, currencyId: currency.id },
    });

    const address = await rawPrisma.address.create({
      data: {
        userId: buyer.id,
        recipientName: 'Buyer Escrow',
        phoneCode: '+245',
        phone: `999${short}`,
        countryId: country.id,
        region: 'Bissau',
        city: 'Bissau',
        street: 'Rua Integration',
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
        payloadHash: `escrow-${seed}`,
        itemsSnapshotJson: [],
        pricingSnapshotJson: {},
        shippingQuotesJson: [],
        estimatedTaxesJson: {},
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const totalAmount = new Prisma.Decimal(total);
    const commissionAmount = new Prisma.Decimal(commission);

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
        orderNumber: `ESC-${seed}`,
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
        shippingServiceName: 'Integration Test',
        estimatedDeliveryMinDays: 1,
        estimatedDeliveryMaxDays: 1,
        addressSnapshotJson: {},
        storeSnapshotJson: {},
        sellerSnapshotJson: {},
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
        commissionAmount,
        currencyId: currency.id,
        status: EscrowStatus.HELD,
        disputeDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      escrowId: escrow.id,
      orderId: order.id,
      sellerUserId: sellerUser.id,
      buyerUserId: buyer.id,
      currencyId: currency.id,
      totalAmount,
      commissionAmount,
    };
  }

  async function financialSnapshot(seed: SeededEscrow) {
    const [escrow, wallet, walletTransactions, ledgerEntries, outboxEvents, escrowTransactions] =
      await Promise.all([
        rawPrisma.escrowAccount.findUniqueOrThrow({
          where: { id: seed.escrowId },
        }),
        rawPrisma.wallet.findUnique({ where: { userId: seed.sellerUserId } }),
        rawPrisma.walletTransaction.findMany({
          where: {
            referenceType: 'EscrowAccount',
            referenceId: seed.escrowId,
          },
        }),
        rawPrisma.ledgerEntry.findMany({
          where: {
            referenceType: 'EscrowAccount',
            referenceId: seed.escrowId,
          },
        }),
        rawPrisma.outboxEvent.findMany({
          where: {
            aggregateType: 'EscrowAccount',
            aggregateId: seed.escrowId,
            eventType: {
              in: ['escrow.partially_released', 'escrow.released'],
            },
          },
        }),
        rawPrisma.escrowTransaction.findMany({
          where: {
            escrowAccountId: seed.escrowId,
            type: { in: ['PARTIAL_RELEASE', 'RELEASE'] },
          },
        }),
      ]);

    return {
      escrow,
      wallet,
      walletTransactions,
      ledgerEntries,
      outboxEvents,
      escrowTransactions,
    };
  }

  function expectEscrowInvariant(
    total: Prisma.Decimal,
    held: Prisma.Decimal,
    released: Prisma.Decimal,
  ) {
    expect(held.gte(0)).toBe(true);
    expect(released.gte(0)).toBe(true);
    expect(released.lte(total)).toBe(true);
    expect(held.add(released).eq(total)).toBe(true);
  }

  async function refundSnapshot(seed: SeededEscrow) {
    const [escrow, buyerWallet, sellerWallet, walletTransactions, ledgerEntries, outboxEvents, escrowTransactions] =
      await Promise.all([
        rawPrisma.escrowAccount.findUniqueOrThrow({ where: { id: seed.escrowId } }),
        rawPrisma.wallet.findUnique({ where: { userId: seed.buyerUserId } }),
        rawPrisma.wallet.findUnique({ where: { userId: seed.sellerUserId } }),
        rawPrisma.walletTransaction.findMany({
          where: { referenceType: 'EscrowAccount', referenceId: seed.escrowId },
        }),
        rawPrisma.ledgerEntry.findMany({
          where: { referenceType: 'EscrowAccount', referenceId: seed.escrowId },
        }),
        rawPrisma.outboxEvent.findMany({
          where: {
            aggregateType: 'EscrowAccount',
            aggregateId: seed.escrowId,
            eventType: {
              in: ['escrow.partially_released', 'escrow.released', 'escrow.refunded', 'escrow.cancelled'],
            },
          },
        }),
        rawPrisma.escrowTransaction.findMany({
          where: { escrowAccountId: seed.escrowId },
        }),
      ]);

    return { escrow, buyerWallet, sellerWallet, walletTransactions, ledgerEntries, outboxEvents, escrowTransactions };
  }

  function expectFullFinancialInvariant(seed: SeededEscrow, snapshot: Awaited<ReturnType<typeof refundSnapshot>>) {
    const held = new Prisma.Decimal(snapshot.escrow.heldAmount);
    const released = new Prisma.Decimal(snapshot.escrow.releasedAmount);
    const refunded = new Prisma.Decimal(snapshot.escrow.refundedAmount);

    expect(held.gte(0)).toBe(true);
    expect(released.gte(0)).toBe(true);
    expect(refunded.gte(0)).toBe(true);
    expect(held.add(released).add(refunded).eq(seed.totalAmount)).toBe(true);
    expect(released.add(refunded).lte(seed.totalAmount)).toBe(true);
  }

  it('1. duas liberações totais concorrentes nunca fazem double payout', async () => {
    const seed = await seedEscrow();

    const results = await Promise.allSettled([
      escrowService.releaseEscrow(seed.orderId),
      escrowService.releaseEscrow(seed.orderId),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);

    const snapshot = await financialSnapshot(seed);

    expect(snapshot.escrow.status).toBe(EscrowStatus.RELEASED);
    expect(snapshot.escrow.heldAmount.eq(0)).toBe(true);
    expect(snapshot.escrow.releasedAmount.eq(seed.totalAmount)).toBe(true);
    expectEscrowInvariant(
      seed.totalAmount,
      snapshot.escrow.heldAmount,
      snapshot.escrow.releasedAmount,
    );

    expect(snapshot.wallet).not.toBeNull();
    expect(snapshot.wallet!.balanceAvailable.eq('90.00')).toBe(true);
    expect(snapshot.walletTransactions).toHaveLength(1);
    expect(snapshot.escrowTransactions).toHaveLength(1);
    expect(snapshot.ledgerEntries).toHaveLength(2);

    const sellerLedger = snapshot.ledgerEntries.find(
      (entry) => entry.creditAccount === 'SELLER_WALLET',
    );
    const platformLedger = snapshot.ledgerEntries.find(
      (entry) => entry.creditAccount === 'PLATFORM_REVENUE',
    );

    expect(sellerLedger).toBeDefined();
    expect(platformLedger).toBeDefined();
    expect(sellerLedger!.debitAccount).toBe('PLATFORM_ESCROW');
    expect(platformLedger!.debitAccount).toBe('PLATFORM_ESCROW');
    expect(new Prisma.Decimal(sellerLedger!.amount).add(platformLedger!.amount).eq(seed.totalAmount)).toBe(true);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.outboxEvents[0].eventType).toBe('escrow.released');

    const ledgerTotal = snapshot.ledgerEntries.reduce(
      (sum, entry) => sum.add(entry.amount),
      new Prisma.Decimal(0),
    );
    expect(ledgerTotal.eq(seed.totalAmount)).toBe(true);
  });

  it('2. duas liberações parciais de 70 concorrentes não podem liberar 140', async () => {
    const seed = await seedEscrow();

    await Promise.allSettled([
      escrowService.releasePartial(seed.orderId, '70.00'),
      escrowService.releasePartial(seed.orderId, '70.00'),
    ]);

    const snapshot = await financialSnapshot(seed);

    expectEscrowInvariant(
      seed.totalAmount,
      snapshot.escrow.heldAmount,
      snapshot.escrow.releasedAmount,
    );
    expect(snapshot.escrow.releasedAmount.eq('70.00')).toBe(true);
    expect(snapshot.escrow.heldAmount.eq('30.00')).toBe(true);
    expect(snapshot.wallet!.balanceAvailable.eq('63.00')).toBe(true);
    expect(snapshot.walletTransactions).toHaveLength(1);
    expect(snapshot.escrowTransactions).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.outboxEvents[0].eventType).toBe('escrow.partially_released');
  });

  it('3. release parcial concorrente com total preserva os invariantes financeiros', async () => {
    const seed = await seedEscrow();

    await Promise.allSettled([
      escrowService.releasePartial(seed.orderId, '40.00'),
      escrowService.releaseEscrow(seed.orderId),
    ]);

    const snapshot = await financialSnapshot(seed);

    expectEscrowInvariant(
      seed.totalAmount,
      snapshot.escrow.heldAmount,
      snapshot.escrow.releasedAmount,
    );
    expect(snapshot.escrow.releasedAmount.lte(seed.totalAmount)).toBe(true);
    expect(snapshot.wallet!.balanceAvailable.lte('90.00')).toBe(true);

    const walletReleased = snapshot.walletTransactions.reduce(
      (sum, transaction) => sum.add(transaction.amount),
      new Prisma.Decimal(0),
    );
    const expectedSellerNet = snapshot.escrow.releasedAmount
      .sub(seed.commissionAmount.mul(snapshot.escrow.releasedAmount).div(seed.totalAmount))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // Se ambas transações forem serializadas com sucesso, a conta termina RELEASED.
    // Se apenas uma vencer, os valores ainda precisam refletir exatamente o saldo consumido.
    expect(walletReleased.eq(snapshot.wallet!.balanceAvailable)).toBe(true);
    expect(walletReleased.lte('90.00')).toBe(true);
    expect(expectedSellerNet.gte(walletReleased.sub('0.01'))).toBe(true);
  });

  it('4. falha do Outbox faz rollback real de Escrow, Wallet e Ledger', async () => {
    const seed = await seedEscrow();

    const failingEvents = {
      recordPartiallyReleased: jest.fn().mockRejectedValue(new Error('forced outbox failure')),
      recordReleased: jest.fn().mockRejectedValue(new Error('forced outbox failure')),
    } as unknown as EscrowEventsService;

    const failingService = buildEscrowService(prisma, failingEvents);

    await expect(failingService.releaseEscrow(seed.orderId)).rejects.toThrow(
      'forced outbox failure',
    );

    const snapshot = await financialSnapshot(seed);

    expect(snapshot.escrow.status).toBe(EscrowStatus.HELD);
    expect(snapshot.escrow.heldAmount.eq(seed.totalAmount)).toBe(true);
    expect(snapshot.escrow.releasedAmount.eq(0)).toBe(true);
    expect(snapshot.wallet).toBeNull();
    expect(snapshot.walletTransactions).toHaveLength(0);
    expect(snapshot.ledgerEntries).toHaveLength(0);
    expect(snapshot.outboxEvents).toHaveLength(0);
    expect(snapshot.escrowTransactions).toHaveLength(0);
  });

  it('5. chamada posterior a RELEASED é idempotente no PostgreSQL real', async () => {
    const seed = await seedEscrow();

    await escrowService.releaseEscrow(seed.orderId);
    const afterFirst = await financialSnapshot(seed);

    await escrowService.releaseEscrow(seed.orderId);
    const afterSecond = await financialSnapshot(seed);

    expect(afterSecond.escrow.status).toBe(EscrowStatus.RELEASED);
    expect(afterSecond.wallet!.balanceAvailable.eq(afterFirst.wallet!.balanceAvailable)).toBe(true);
    expect(afterSecond.walletTransactions).toHaveLength(afterFirst.walletTransactions.length);
    expect(afterSecond.ledgerEntries).toHaveLength(afterFirst.ledgerEntries.length);
    expect(afterSecond.outboxEvents).toHaveLength(afterFirst.outboxEvents.length);
    expect(afterSecond.escrowTransactions).toHaveLength(afterFirst.escrowTransactions.length);
  });

  it('6. conflito concorrente é erro de negócio estável quando um worker perde o CAS', async () => {
    const seed = await seedEscrow();

    const settled = await Promise.allSettled([
      escrowService.releasePartial(seed.orderId, '60.00'),
      escrowService.releasePartial(seed.orderId, '60.00'),
    ]);

    const rejected = settled.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (rejected.length > 0) {
      expect(
        rejected.some(
          (result) =>
            result.reason instanceof ConflictException ||
            result.reason?.response?.errorCode === 'ESCROW_CONCURRENT_MODIFICATION' ||
            result.reason?.response?.errorCode === 'ESCROW_RELEASE_EXCEEDS_HELD_AMOUNT',
        ),
      ).toBe(true);
    }

    const snapshot = await financialSnapshot(seed);
    expectEscrowInvariant(
      seed.totalAmount,
      snapshot.escrow.heldAmount,
      snapshot.escrow.releasedAmount,
    );
    expect(snapshot.escrow.releasedAmount.lte(seed.totalAmount)).toBe(true);
  });

  it('7. release total vs refund total concorrentes nunca fazem double spend', async () => {
    const seed = await seedEscrow();

    const settled = await Promise.allSettled([
      escrowService.releaseEscrow(seed.orderId),
      escrowService.refundEscrow(seed.orderId),
    ]);

    expect(settled.some((result) => result.status === 'fulfilled')).toBe(true);

    const snapshot = await refundSnapshot(seed);
    expectFullFinancialInvariant(seed, snapshot);
    expect(snapshot.escrow.heldAmount.eq(0)).toBe(true);

    const released = new Prisma.Decimal(snapshot.escrow.releasedAmount);
    const refunded = new Prisma.Decimal(snapshot.escrow.refundedAmount);

    expect(
      (released.eq(seed.totalAmount) && refunded.eq(0)) ||
      (released.eq(0) && refunded.eq(seed.totalAmount)),
    ).toBe(true);

    const buyerBalance = snapshot.buyerWallet?.balanceAvailable ?? new Prisma.Decimal(0);
    const sellerBalance = snapshot.sellerWallet?.balanceAvailable ?? new Prisma.Decimal(0);

    if (snapshot.escrow.status === EscrowStatus.RELEASED) {
      expect(buyerBalance.eq(0)).toBe(true);
      expect(sellerBalance.eq('90.00')).toBe(true);
    } else {
      expect(snapshot.escrow.status).toBe(EscrowStatus.REFUNDED);
      expect(buyerBalance.eq(seed.totalAmount)).toBe(true);
      expect(sellerBalance.eq(0)).toBe(true);
    }

    expect(snapshot.escrowTransactions).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(1);
  });

  it('8. dois refunds totais concorrentes creditam o comprador uma única vez', async () => {
    const seed = await seedEscrow();

    await Promise.allSettled([
      escrowService.refundEscrow(seed.orderId),
      escrowService.refundEscrow(seed.orderId),
    ]);

    const snapshot = await refundSnapshot(seed);
    expectFullFinancialInvariant(seed, snapshot);
    expect(snapshot.escrow.status).toBe(EscrowStatus.REFUNDED);
    expect(snapshot.escrow.heldAmount.eq(0)).toBe(true);
    expect(snapshot.escrow.refundedAmount.eq(seed.totalAmount)).toBe(true);
    expect(snapshot.buyerWallet).not.toBeNull();
    expect(snapshot.buyerWallet!.balanceAvailable.eq(seed.totalAmount)).toBe(true);
    expect(snapshot.sellerWallet).toBeNull();
    expect(snapshot.walletTransactions).toHaveLength(1);
    expect(snapshot.escrowTransactions).toHaveLength(1);
    expect(snapshot.outboxEvents).toHaveLength(1);
    expect(snapshot.outboxEvents[0].eventType).toBe('escrow.refunded');
    expect(snapshot.ledgerEntries).toHaveLength(1);
    expect(snapshot.ledgerEntries[0].debitAccount).toBe('PLATFORM_ESCROW');
    expect(snapshot.ledgerEntries[0].creditAccount).toBe('BUYER_WALLET');
    expect(new Prisma.Decimal(snapshot.ledgerEntries[0].amount).eq(seed.totalAmount)).toBe(true);
  });

  it('9. release parcial vs refund total concorrentes preservam held + released + refunded = total', async () => {
    const seed = await seedEscrow();

    await Promise.allSettled([
      escrowService.releasePartial(seed.orderId, '40.00'),
      escrowService.refundEscrow(seed.orderId),
    ]);

    const snapshot = await refundSnapshot(seed);
    expectFullFinancialInvariant(seed, snapshot);

    const released = new Prisma.Decimal(snapshot.escrow.releasedAmount);
    const refunded = new Prisma.Decimal(snapshot.escrow.refundedAmount);
    expect(released.add(refunded).lte(seed.totalAmount)).toBe(true);

    const buyerBalance = snapshot.buyerWallet?.balanceAvailable ?? new Prisma.Decimal(0);
    const sellerBalance = snapshot.sellerWallet?.balanceAvailable ?? new Prisma.Decimal(0);
    expect(buyerBalance.eq(refunded)).toBe(true);
    expect(sellerBalance.lte('90.00')).toBe(true);

    // Nunca pode haver distribuição financeira superior ao total originalmente retido.
    expect(released.add(refunded).lte(seed.totalAmount)).toBe(true);
  });

});
