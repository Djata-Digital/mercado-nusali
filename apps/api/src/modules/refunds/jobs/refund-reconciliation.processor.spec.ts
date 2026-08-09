import { RefundReconciliationProcessor } from './refund-reconciliation.processor';

describe('RefundReconciliationProcessor - Sprint 7.4.5', () => {
  it('deve executar reconciliation e avaliação de alertas', async () => {
    const reconciliation: any = {
      reconcileStaleProcessing: jest.fn().mockResolvedValue({
        scanned: 2,
        completed: 2,
      }),
    };
    const alerts: any = {
      evaluate: jest.fn().mockResolvedValue({
        healthy: true,
        alerts: [],
      }),
    };

    const processor = new RefundReconciliationProcessor(
      reconciliation,
      alerts,
    );

    const result = await processor.process({
      id: 'job-1',
      name: 'reconcile-stale-refunds',
      data: { limit: 25 },
    } as any);

    expect(result.reconciliation.completed).toBe(2);
    expect(reconciliation.reconcileStaleProcessing).toHaveBeenCalledWith(25);
    expect(alerts.evaluate).toHaveBeenCalledTimes(1);
  });
});
