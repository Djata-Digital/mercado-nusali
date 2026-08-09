import { RefundMetricsService } from './refund-metrics.service';

describe('RefundMetricsService - Sprint 7.4.5', () => {
  it('deve calcular contadores, média e p95 sem usar Number para dinheiro', async () => {
    const now = Date.now();
    const prisma: any = {
      refund: {
        count: jest
          .fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2),
        findMany: jest.fn().mockResolvedValue([
          {
            createdAt: new Date(now - 1000),
            processedAt: new Date(now),
          },
          {
            createdAt: new Date(now - 3000),
            processedAt: new Date(now),
          },
        ]),
      },
      webhookEvent: {
        count: jest.fn().mockResolvedValue(4),
      },
    };

    const service = new RefundMetricsService(prisma);
    const result = await service.snapshot();

    expect(result.counts).toEqual({
      pending: 2,
      processing: 3,
      completed: 10,
      failed: 1,
      staleProcessing: 2,
      failedWebhooks: 4,
    });
    expect(result.latency.sampleSize).toBe(2);
    expect(result.latency.averageProcessingMs).toBe(2000);
    expect(result.latency.p95ProcessingMs).toBe(3000);
  });
});
