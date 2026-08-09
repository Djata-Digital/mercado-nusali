import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';

describe('FinancialReconciliationMetricsService - Sprint 7.5.4', () => {
  it('agrega incidentes por status e severidade', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        groupBy: jest.fn().mockResolvedValue([
          {
            status: 'OPEN',
            severity: 'CRITICAL',
            _count: { _all: 2 },
          },
          {
            status: 'ACKNOWLEDGED',
            severity: 'WARNING',
            _count: { _all: 3 },
          },
          {
            status: 'RESOLVED',
            severity: 'WARNING',
            _count: { _all: 4 },
          },
        ]),
      },
    };

    const service = new FinancialReconciliationMetricsService(prisma);

    await expect(service.getSummary()).resolves.toEqual({
      total: 9,
      open: 2,
      acknowledged: 3,
      resolved: 4,
      warning: 7,
      critical: 2,
    });
  });
});
