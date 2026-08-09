import { RefundReconciliationScheduler } from './refund-reconciliation.scheduler';

describe('RefundReconciliationScheduler - Sprint 7.4.5', () => {
  it('deve registrar job repetível com retry/backoff', async () => {
    const queue: any = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const scheduler = new RefundReconciliationScheduler(queue);
    await scheduler.registerRepeatableJob();

    expect(queue.add).toHaveBeenCalledWith(
      'reconcile-stale-refunds',
      { limit: 50 },
      expect.objectContaining({
        jobId: 'refund-reconciliation-scheduler',
        repeat: { every: 60000 },
        attempts: 5,
      }),
    );
  });
});
