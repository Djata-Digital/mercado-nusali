import { Prisma, SellerSettlementStatus, SettlementBatchStatus } from '@prisma/client';
import { SettlementBatchOperationsService } from './settlement-batch-operations.service';

describe('SettlementBatchOperationsService - Sprint 7.6.5', () => {
  function build() {
    const prisma: any = {
      settlementBatch: { findUnique: jest.fn() },
      sellerSettlement: { findMany: jest.fn(), groupBy: jest.fn() },
    };
    const payouts: any = { reconcilePayout: jest.fn() };
    return { prisma, payouts, service: new SettlementBatchOperationsService(prisma, payouts) };
  }

  it('reconcilia payouts vinculados e continua quando uma linha falha', async () => {
    const { service, prisma, payouts } = build();
    prisma.settlementBatch.findUnique.mockResolvedValue({ id: 'b1' });
    prisma.sellerSettlement.findMany.mockResolvedValue([
      { id: 's1', sellerId: 'a', payoutId: 'p1' },
      { id: 's2', sellerId: 'b', payoutId: 'p2' },
      { id: 's3', sellerId: 'c', payoutId: null },
    ]);
    payouts.reconcilePayout
      .mockResolvedValueOnce({ action: 'MARKED_SETTLED', consistent: true })
      .mockRejectedValueOnce(new Error('provider unavailable'));
    const result = await service.reconcileBatch('b1');
    expect(result).toMatchObject({ scanned: 3, reconciled: 1, failures: 1 });
    expect(payouts.reconcilePayout).toHaveBeenCalledTimes(2);
  });

  it('bloqueia finalização lógica enquanto houver settlement não terminal', async () => {
    const { service, prisma } = build();
    prisma.settlementBatch.findUnique.mockResolvedValue({ id: 'b1', status: SettlementBatchStatus.CLOSED });
    prisma.sellerSettlement.groupBy.mockResolvedValue([
      { status: SellerSettlementStatus.SETTLED, _count: { _all: 2 } },
      { status: SellerSettlementStatus.PAYOUT_PENDING, _count: { _all: 1 } },
    ]);
    const result = await service.finalizationStatus('b1');
    expect(result.finalizable).toBe(false);
    expect(result.blockers).toContain('NON_TERMINAL_SETTLEMENTS');
  });

  it('considera finalizado e saudável quando todos estão SETTLED', async () => {
    const { service, prisma } = build();
    prisma.settlementBatch.findUnique.mockResolvedValue({ id: 'b1', status: SettlementBatchStatus.CLOSED });
    prisma.sellerSettlement.groupBy.mockResolvedValue([
      { status: SellerSettlementStatus.SETTLED, _count: { _all: 4 } },
    ]);
    const result = await service.finalizationStatus('b1');
    expect(result.finalizable).toBe(true);
    expect(result.healthyFinalization).toBe(true);
  });

  it('gera relatório sem converter dinheiro para Number', async () => {
    const { service, prisma } = build();
    prisma.settlementBatch.findUnique.mockResolvedValue({
      id: 'b1', periodStart: new Date('2026-08-01'), periodEnd: new Date('2026-08-08'),
      currencyId: 'BRL', status: SettlementBatchStatus.CLOSED, closedAt: new Date('2026-08-08'),
    });
    prisma.sellerSettlement.findMany.mockResolvedValue([
      { id: 's1', sellerId: 'a', status: SellerSettlementStatus.SETTLED, payoutId: 'p1',
        grossAmount: new Prisma.Decimal('100.1234'), platformFee: new Prisma.Decimal('10.1234'),
        adjustments: new Prisma.Decimal('1.0000'), payoutAmount: new Prisma.Decimal('91.0000') },
      { id: 's2', sellerId: 'b', status: SellerSettlementStatus.FAILED, payoutId: 'p2',
        grossAmount: new Prisma.Decimal('50.0000'), platformFee: new Prisma.Decimal('5.0000'),
        adjustments: new Prisma.Decimal('-1.0000'), payoutAmount: new Prisma.Decimal('44.0000') },
    ]);
    const report = await service.report('b1');
    expect(report.totals.grossAmount).toBe('150.1234');
    expect(report.totals.payoutAmount).toBe('135');
    expect(report.byStatus.SETTLED).toBe(1);
    expect(report.byStatus.FAILED).toBe(1);
  });
});
