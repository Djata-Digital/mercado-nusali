import { FinancialReconciliationSchedulerService } from './financial-reconciliation-scheduler.service';

describe('FinancialReconciliationSchedulerService - Sprint 7.5.8', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FINANCIAL_RECONCILIATION_SCHEDULER_ENABLED =
      'true';
    process.env.FINANCIAL_RECONCILIATION_BATCH_SIZE = '25';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('registra sucesso e heartbeat operacional', async () => {
    const scans: any = {
      scan: jest.fn().mockResolvedValue({
        scanned: 2,
        healthy: 2,
        unhealthy: 0,
        failed: 0,
      }),
    };

    const service = new FinancialReconciliationSchedulerService(
      scans,
    );

    const result = await service.runOnce();
    const status = service.getStatus();

    expect(result.skipped).toBe(false);
    expect(status.totalRuns).toBe(1);
    expect(status.consecutiveFailures).toBe(0);
    expect(status.lastSuccessAt).toBeInstanceOf(Date);
    expect(status.lastError).toBeNull();
    expect(scans.scan).toHaveBeenCalledWith(25);
  });

  it('contabiliza falhas consecutivas', async () => {
    const scans: any = {
      scan: jest
        .fn()
        .mockRejectedValue(new Error('postgres unavailable')),
    };

    const service = new FinancialReconciliationSchedulerService(
      scans,
    );

    await expect(service.runOnce()).rejects.toThrow(
      'postgres unavailable',
    );

    const status = service.getStatus();
    expect(status.consecutiveFailures).toBe(1);
    expect(status.lastError).toBe('postgres unavailable');
  });

  it('impede scans sobrepostos', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    const scans: any = {
      scan: jest.fn().mockImplementation(async () => {
        await pending;
        return { scanned: 1 };
      }),
    };

    const service = new FinancialReconciliationSchedulerService(
      scans,
    );

    const first = service.runOnce();
    await Promise.resolve();

    const second = await service.runOnce();

    expect(second).toEqual({
      skipped: true,
      reason: 'PREVIOUS_RUN_STILL_ACTIVE',
    });
    expect(service.getStatus().skippedOverlaps).toBe(1);

    release();
    await first;
  });
});
