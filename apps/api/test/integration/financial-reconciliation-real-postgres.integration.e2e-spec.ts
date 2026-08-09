import {
  EscrowStatus,
  LedgerAccountType,
  OrderStatus,
  PaymentMethodType,
  PaymentProvider,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  PrismaClient,
  RefundStatus,
  SellerStatus,
  StoreStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

import { FinancialReconciliationService } from '../../src/modules/financial-reconciliation/financial-reconciliation.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

type SeededFinancialDomain = {
  buyerId: string;
  sellerId: string;
  orderId: string;
  orderGroupId: string;
  paymentId: string;
  paymentIntentId: string;
  escrowId: string;
  currencyId: string;
  totalAmount: Prisma.Decimal;
};

describe('Sprint 7.5.2 - Financial Reconciliation Real PostgreSQL & Cross-Module Invariants', () => {
  jest.setTimeout(120000);

  const dbUrlTest = process.env.DATABASE_URL_TEST || '';
  let prisma: PrismaService;
  let rawPrisma: PrismaClient;
  let service: FinancialReconciliationService;

  beforeAll(async () => {
    if (!dbUrlTest) {
      throw new Error(
        'DATABASE_URL_TEST é obrigatória para a Sprint 7.5.2.',
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
    rawPrisma = prisma as unknown as PrismaClient;
    await prisma.$connect();
    service = new FinancialReconciliationService(prisma);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  async function seedDomain(total = '100.00'): Promise<SeededFinancialDomain> {
    const seed = crypto.randomUUID();
    const short = seed.replace(/-/g, '').slice(0, 10);
    const totalAmount = new Prisma.Decimal(total);

    const currency = await rawPrisma.currency.create({
      data: {
        code: `F${short.slice(0, 5)}`,
        name: `Financial Reconciliation ${short}`,
        symbol: 'T',
        decimals: 2,
      },
    });

    const country = await rawPrisma.country.create({
      data: {
        code: `FC${short.slice(0, 5)}`,
        name: `Financial Country ${short}`,
        flag: '🏳️',
        phonePrefix: `+${short.slice(0, 5)}`,
      },
    });

    const buyer = await rawPrisma.user.create({
      data: {
        firstName: 'Buyer',
        lastName: `Finance ${short}`,
        email: `finance-buyer-${seed}@integration.test`,
        phone: `24591${short}`,
        phoneCode: '+245',
        passwordHash: 'integration-test-hash',
        countryId: country.id,
        preferredCurrencyId: currency.id,
      },
    });

    const sellerUser = await rawPrisma.user.create({
      data: {
        firstName: 'Seller',
        lastName: `Finance ${short}`,
        email: `finance-seller-${seed}@integration.test`,
        phone: `24592${short}`,
        phoneCode: '+245',
        passwordHash: 'integration-test-hash',
        countryId: country.id,
        preferredCurrencyId: currency.id,
      },
    });

    const seller = await rawPrisma.sellerProfile.create({
      data: {
        userId: sellerUser.id,
        legalName: `Financial Seller ${short}`,
        tradeName: `Financial Seller ${short}`,
        countryId: country.id,
        status: SellerStatus.VERIFIED,
      },
    });

    const store = await rawPrisma.store.create({
      data: {
        sellerId: seller.id,
        countryId: country.id,
        name: `Financial Store ${short}`,
        slug: `financial-store-${seed}`,
        status: StoreStatus.ACTIVE,
      },
    });

    const cart = await rawPrisma.cart.create({
      data: { userId: buyer.id, currencyId: currency.id },
    });

    const address = await rawPrisma.address.create({
      data: {
        userId: buyer.id,
        recipientName: 'Financial Buyer',
        phoneCode: '+245',
        phone: `993${short}`,
        countryId: country.id,
        region: 'Bissau',
        city: 'Bissau',
        street: 'Rua Financial Integration',
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
        payloadHash: `financial-${seed}`,
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
        orderNumber: `FIN-${seed}`,
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
        shippingServiceName: 'Financial Integration',
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
      paymentIntentId: paymentIntent.id,
      escrowId: escrow.id,
      currencyId: currency.id,
      totalAmount,
    };
  }

  async function createCompletedRefund(
    seed: SeededFinancialDomain,
    amount: string,
  ) {
    return rawPrisma.refund.create({
      data: {
        paymentId: seed.paymentId,
        orderId: seed.orderId,
        buyerId: seed.buyerId,
        amount: new Prisma.Decimal(amount),
        currencyId: seed.currencyId,
        reason: 'Financial reconciliation integration',
        status: RefundStatus.COMPLETED,
        processedAt: new Date(),
      },
    });
  }

  async function createPaidPayout(
    seed: SeededFinancialDomain,
    amount: string,
  ) {
    const payout = await rawPrisma.payout.create({
      data: {
        sellerId: seed.sellerId,
        amount: new Prisma.Decimal(amount),
        currencyId: seed.currencyId,
        status: PayoutStatus.PAID,
        payoutMethod: 'TEST',
        processedAt: new Date(),
      },
    });

    await rawPrisma.payoutItem.create({
      data: {
        payoutId: payout.id,
        escrowAccountId: seed.escrowId,
        amount: new Prisma.Decimal(amount),
      },
    });

    return payout;
  }

  async function createLedger(
    seed: SeededFinancialDomain,
    referenceType: 'REFUND' | 'PAYOUT',
    referenceId: string,
    amount: string,
  ) {
    return rawPrisma.ledgerEntry.create({
      data: {
        transactionId: `FIN-${crypto.randomUUID()}`,
        debitAccount:
          referenceType === 'REFUND'
            ? LedgerAccountType.PLATFORM_ESCROW
            : LedgerAccountType.SELLER_WALLET,
        creditAccount:
          referenceType === 'REFUND'
            ? LedgerAccountType.REFUND
            : LedgerAccountType.GATEWAY_CLEARING,
        amount: new Prisma.Decimal(amount),
        currencyId: seed.currencyId,
        referenceType,
        referenceId,
        description: 'Financial reconciliation integration ledger',
      },
    });
  }

  it('1. cenário íntegro é considerado healthy no PostgreSQL real', async () => {
    const seed = await seedDomain('100.00');

    const result = await service.reconcilePayment(seed.paymentId);

    expect(result.healthy).toBe(true);
    expect(result.totals.payment).toBe('100.00');
    expect(result.totals.escrow).toBe('100.00');
    expect(result.issues).toHaveLength(0);
  });

  it('2. detecta over-refund real acima do valor do Payment', async () => {
    const seed = await seedDomain('100.00');
    await createCompletedRefund(seed, '120.00');
    await rawPrisma.payment.update({
      where: { id: seed.paymentId },
      data: { status: PaymentStatus.REFUNDED },
    });

    const result = await service.reconcilePayment(seed.paymentId);

    expect(result.healthy).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      'REFUND_EXCEEDS_PAYMENT',
    );
    expect(result.totals.refunded).toBe('120.00');
  });

  it('3. detecta held + released + refunded diferente do totalAmount', async () => {
    const seed = await seedDomain('100.00');
    await rawPrisma.escrowAccount.update({
      where: { id: seed.escrowId },
      data: {
        heldAmount: new Prisma.Decimal('60.00'),
        releasedAmount: new Prisma.Decimal('20.00'),
        refundedAmount: new Prisma.Decimal('10.00'),
      },
    });

    const result = await service.reconcilePayment(seed.paymentId);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ESCROW_INVARIANT_BROKEN',
          expected: '100.00',
          actual: '90.00',
        }),
      ]),
    );
  });

  it('4. detecta Payout PAID acima do releasedAmount do Escrow', async () => {
    const seed = await seedDomain('100.00');
    await rawPrisma.escrowAccount.update({
      where: { id: seed.escrowId },
      data: {
        heldAmount: new Prisma.Decimal('20.00'),
        releasedAmount: new Prisma.Decimal('80.00'),
      },
    });
    await createPaidPayout(seed, '90.00');

    const result = await service.reconcilePayment(seed.paymentId);

    expect(result.issues.map((issue) => issue.code)).toContain(
      'PAYOUT_EXCEEDS_RELEASED',
    );
    expect(result.totals.payoutPaid).toBe('90.00');
  });

  it('5. detecta Payment REFUNDED sem reembolso integral', async () => {
    const seed = await seedDomain('100.00');
    await createCompletedRefund(seed, '70.00');
    await rawPrisma.payment.update({
      where: { id: seed.paymentId },
      data: { status: PaymentStatus.REFUNDED },
    });
    await rawPrisma.escrowAccount.update({
      where: { id: seed.escrowId },
      data: {
        heldAmount: new Prisma.Decimal('30.00'),
        refundedAmount: new Prisma.Decimal('70.00'),
      },
    });

    const result = await service.reconcilePayment(seed.paymentId);

    expect(result.issues.map((issue) => issue.code)).toContain(
      'REFUNDED_PAYMENT_AMOUNT_MISMATCH',
    );
  });

  it('6. detecta Ledger de Refund abaixo do total COMPLETED', async () => {
    const seed = await seedDomain('100.00');
    const refund = await createCompletedRefund(seed, '60.00');
    await rawPrisma.payment.update({
      where: { id: seed.paymentId },
      data: { status: PaymentStatus.PARTIALLY_REFUNDED },
    });
    await rawPrisma.escrowAccount.update({
      where: { id: seed.escrowId },
      data: {
        heldAmount: new Prisma.Decimal('40.00'),
        refundedAmount: new Prisma.Decimal('60.00'),
      },
    });
    await createLedger(seed, 'REFUND', refund.id, '20.00');

    const result = await service.reconcilePayment(seed.paymentId);

    expect(result.issues.map((issue) => issue.code)).toContain(
      'REFUND_LEDGER_MISMATCH',
    );
    expect(result.totals.refundLedger).toBe('20.00');
  });

  it('7. detecta Ledger de Payout abaixo do total PAID', async () => {
    const seed = await seedDomain('100.00');
    await rawPrisma.escrowAccount.update({
      where: { id: seed.escrowId },
      data: {
        heldAmount: new Prisma.Decimal('50.00'),
        releasedAmount: new Prisma.Decimal('50.00'),
      },
    });
    const payout = await createPaidPayout(seed, '50.00');
    await createLedger(seed, 'PAYOUT', payout.id, '10.00');

    const result = await service.reconcilePayment(seed.paymentId);

    expect(result.issues.map((issue) => issue.code)).toContain(
      'PAYOUT_LEDGER_MISMATCH',
    );
    expect(result.totals.payoutLedger).toBe('10.00');
  });

  it('8. reconcileOrderGroup agrega múltiplos Payments e propaga unhealthy', async () => {
    const seed = await seedDomain('100.00');

    const secondPayment = await rawPrisma.payment.create({
      data: {
        paymentIntentId: seed.paymentIntentId,
        orderGroupId: seed.orderGroupId,
        buyerId: seed.buyerId,
        amount: new Prisma.Decimal('100.00'),
        currencyId: seed.currencyId,
        method: PaymentMethodType.PIX,
        provider: PaymentProvider.PIX_INTERNAL,
        providerReference: `provider-ref-${crypto.randomUUID()}`,
        providerTransactionId: `provider-tx-${crypto.randomUUID()}`,
        status: PaymentStatus.REFUNDED,
        paidAt: new Date(),
      },
    });

    // O segundo Payment está REFUNDED, mas não possui Refund COMPLETED.
    const result = await service.reconcileOrderGroup(seed.orderGroupId);

    expect(result.payments).toHaveLength(2);
    expect(result.healthy).toBe(false);
    expect(result.issueCount).toBeGreaterThanOrEqual(1);
    expect(
      result.payments.find((item) => item.paymentId === secondPayment.id)?.issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'REFUNDED_PAYMENT_AMOUNT_MISMATCH' }),
      ]),
    );
  });
});
