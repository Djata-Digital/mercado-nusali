import { RefundStatus } from '@prisma/client';

import { RefundProviderExecutionService } from './refund-provider-execution.service';
import { RefundReconciliationService } from './refund-reconciliation.service';

describe('RefundReconciliationService - Sprint 7.4.3', () => {
  function build() {
    const prisma: any = {
      refund: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    const execution = {
      reconcile: jest.fn(),
    };

    const service = new RefundReconciliationService(
      prisma,
      execution as unknown as RefundProviderExecutionService,
    );

    return { service, prisma, execution };
  }

  it('deve reconciliar refunds PROCESSING antigos', async () => {
    const { service, prisma, execution } = build();

    prisma.refund.findMany.mockResolvedValue([
      { id: 'refund-1' },
      { id: 'refund-2' },
    ]);

    execution.reconcile
      .mockResolvedValueOnce({
        id: 'refund-1',
        status: RefundStatus.COMPLETED,
      })
      .mockResolvedValueOnce({
        id: 'refund-2',
        status: RefundStatus.PROCESSING,
      });

    const result = await service.reconcileStaleProcessing();

    expect(result.scanned).toBe(2);
    expect(result.completed).toBe(1);
    expect(result.stillProcessing).toBe(1);
  });

  it('deve contar conflito de lease sem abortar o lote', async () => {
    const { service, prisma, execution } = build();

    prisma.refund.findMany.mockResolvedValue([
      { id: 'refund-1' },
      { id: 'refund-2' },
    ]);

    execution.reconcile
      .mockRejectedValueOnce({
        status: 409,
      })
      .mockResolvedValueOnce({
        id: 'refund-2',
        status: RefundStatus.COMPLETED,
      });

    const result = await service.reconcileStaleProcessing();

    expect(result.conflicts).toBe(1);
    expect(result.completed).toBe(1);
  });

  it('deve inspecionar total COMPLETED do Payment', async () => {
    const { service, prisma } = build();

    prisma.refund.findUnique.mockResolvedValue({
      id: 'refund-1',
      paymentId: 'payment-1',
      status: RefundStatus.PROCESSING,
      updatedAt: new Date(Date.now() - 120_000),
      payment: {
        status: 'PARTIALLY_REFUNDED',
        amount: { toString: () => '100' },
      },
    });

    prisma.refund.aggregate.mockResolvedValue({
      _sum: {
        amount: { toString: () => '40' },
      },
    });

    const result = await service.inspect('refund-1');

    expect(result).not.toBeNull();
    expect(result!.completedRefundTotal).toBe('40');
    expect(result!.stale).toBe(true);
  });
});
