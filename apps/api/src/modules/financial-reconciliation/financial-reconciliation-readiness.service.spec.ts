import { FinancialReconciliationReadinessService } from './financial-reconciliation-readiness.service';

describe('FinancialReconciliationReadinessService - Sprint 7.5.8', () => {
  function build(options?: {
    dbFails?: boolean;
    critical?: number;
    consecutiveFailures?: number;
  }) {
    const prisma: any = {
      $queryRawUnsafe: options?.dbFails
        ? jest.fn().mockRejectedValue(new Error('db down'))
        : jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const metrics: any = {
      getSummary: jest.fn().mockResolvedValue({
        total: options?.critical ?? 0,
        open: options?.critical ?? 0,
        acknowledged: 0,
        resolved: 0,
        warning: 0,
        critical: options?.critical ?? 0,
      }),
    };

    const scheduler: any = {
      getStatus: jest.fn().mockReturnValue({
        enabled: true,
        running: false,
        totalRuns: 1,
        skippedOverlaps: 0,
        consecutiveFailures:
          options?.consecutiveFailures ?? 0,
        lastStartedAt: new Date(),
        lastFinishedAt: new Date(),
        lastSuccessAt: new Date(),
        lastError: null,
        intervalMs: 300000,
        batchSize: 100,
      }),
    };

    return new FinancialReconciliationReadinessService(
      prisma,
      metrics,
      scheduler,
    );
  }

  it('fica ready quando banco, scheduler e incidentes estão saudáveis', async () => {
    const service = build();
    const result = await service.check();

    expect(result.ready).toBe(true);
    expect(result.checks.database.ready).toBe(true);
    expect(result.checks.scheduler.ready).toBe(true);
  });

  it('fica not-ready quando banco não responde', async () => {
    const service = build({ dbFails: true });
    const result = await service.check();

    expect(result.ready).toBe(false);
    expect(result.checks.database.ready).toBe(false);
  });

  it('fica not-ready após falhas consecutivas do scheduler', async () => {
    const service = build({ consecutiveFailures: 3 });
    const result = await service.check();

    expect(result.ready).toBe(false);
    expect(result.checks.scheduler.ready).toBe(false);
  });
});
