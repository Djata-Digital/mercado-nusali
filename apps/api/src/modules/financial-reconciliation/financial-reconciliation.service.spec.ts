import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { FinancialReconciliationService } from './financial-reconciliation.service';

describe('FinancialReconciliationService - Sprint 7.5.1', () => {
  const prisma = {
    payment: { findUnique: jest.fn(), findMany: jest.fn() },
    escrowAccount: { findMany: jest.fn() },
    ledgerEntry: { findMany: jest.fn() },
  } as any;

  let service: FinancialReconciliationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FinancialReconciliationService(prisma);
    prisma.escrowAccount.findMany.mockResolvedValue([]);
    prisma.ledgerEntry.findMany.mockResolvedValue([]);
  });

  it('deve considerar saudável um pagamento sem divergências', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderGroupId: 'og-1', amount: new Prisma.Decimal('100.00'),
      currencyId: 'xof', status: PaymentStatus.CAPTURED, refunds: [],
    });

    const result = await service.reconcilePayment('pay-1');

    expect(result.healthy).toBe(true);
    expect(result.totals.payment).toBe('100.00');
    expect(result.totals.refunded).toBe('0.00');
    expect(result.issues).toEqual([]);
  });

  it('deve detectar refund COMPLETED acima do Payment', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderGroupId: 'og-1', amount: new Prisma.Decimal('100.00'),
      currencyId: 'xof', status: PaymentStatus.REFUNDED,
      refunds: [{ id: 'ref-1', amount: new Prisma.Decimal('120.00'), status: RefundStatus.COMPLETED }],
    });

    const result = await service.reconcilePayment('pay-1');

    expect(result.healthy).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('REFUND_EXCEEDS_PAYMENT');
  });

  it('deve detectar quebra do invariante financeiro do Escrow', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderGroupId: 'og-1', amount: new Prisma.Decimal('100.00'),
      currencyId: 'xof', status: PaymentStatus.CAPTURED, refunds: [],
    });
    prisma.escrowAccount.findMany.mockResolvedValue([{
      id: 'esc-1', totalAmount: new Prisma.Decimal('100.00'), heldAmount: new Prisma.Decimal('20.00'),
      releasedAmount: new Prisma.Decimal('50.00'), refundedAmount: new Prisma.Decimal('10.00'), payoutItems: [],
    }]);

    const result = await service.reconcilePayment('pay-1');

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'ESCROW_INVARIANT_BROKEN', expected: '100.00', actual: '80.00' }),
    ]));
  });

  it('deve detectar payout PAID acima do releasedAmount', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderGroupId: 'og-1', amount: new Prisma.Decimal('100.00'),
      currencyId: 'xof', status: PaymentStatus.CAPTURED, refunds: [],
    });
    prisma.escrowAccount.findMany.mockResolvedValue([{
      id: 'esc-1', totalAmount: new Prisma.Decimal('100.00'), heldAmount: new Prisma.Decimal('20.00'),
      releasedAmount: new Prisma.Decimal('80.00'), refundedAmount: new Prisma.Decimal('0.00'),
      payoutItems: [{ payoutId: 'po-1', amount: new Prisma.Decimal('90.00') }],
    }]);

    const result = await service.reconcilePayment('pay-1');

    expect(result.issues.map((issue) => issue.code)).toContain('PAYOUT_EXCEEDS_RELEASED');
  });

  it('deve detectar Payment REFUNDED sem refund integral', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderGroupId: 'og-1', amount: new Prisma.Decimal('100.00'),
      currencyId: 'xof', status: PaymentStatus.REFUNDED,
      refunds: [{ id: 'ref-1', amount: new Prisma.Decimal('70.00'), status: RefundStatus.COMPLETED }],
    });

    const result = await service.reconcilePayment('pay-1');
    expect(result.issues.map((issue) => issue.code)).toContain('REFUNDED_PAYMENT_AMOUNT_MISMATCH');
  });

  it('deve agregar todos os Payments de um OrderGroup', async () => {
    prisma.payment.findMany.mockResolvedValue([{ id: 'pay-1' }, { id: 'pay-2' }]);
    const spy = jest.spyOn(service, 'reconcilePayment')
      .mockResolvedValueOnce({ healthy: true, issues: [] } as any)
      .mockResolvedValueOnce({ healthy: false, issues: [{ code: 'REFUND_EXCEEDS_PAYMENT' }] } as any);

    const result = await service.reconcileOrderGroup('og-1');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.healthy).toBe(false);
    expect(result.issueCount).toBe(1);
  });
});
