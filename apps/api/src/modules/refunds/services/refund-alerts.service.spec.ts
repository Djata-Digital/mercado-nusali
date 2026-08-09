import { RefundAlertsService } from './refund-alerts.service';

describe('RefundAlertsService - Sprint 7.4.5', () => {
  it('deve gerar WARNING e CRITICAL conforme thresholds', async () => {
    const metrics: any = {
      snapshot: jest.fn().mockResolvedValue({
        counts: {
          staleProcessing: 6,
          failed: 1,
          failedWebhooks: 0,
        },
      }),
    };

    const service = new RefundAlertsService(metrics);
    const result = await service.evaluate();

    expect(result.healthy).toBe(false);
    expect(result.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'REFUND_STALE_PROCESSING',
          severity: 'CRITICAL',
        }),
        expect.objectContaining({
          code: 'REFUND_FAILED',
          severity: 'WARNING',
        }),
      ]),
    );
  });

  it('deve ficar saudável quando não há violações', async () => {
    const metrics: any = {
      snapshot: jest.fn().mockResolvedValue({
        counts: {
          staleProcessing: 0,
          failed: 0,
          failedWebhooks: 0,
        },
      }),
    };

    const service = new RefundAlertsService(metrics);
    const result = await service.evaluate();

    expect(result.healthy).toBe(true);
    expect(result.alerts).toHaveLength(0);
  });
});
