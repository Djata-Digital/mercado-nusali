import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';

describe('FinancialReconciliationScanService - Sprint 7.5.4', () => {
  it('varre OrderGroups, persiste incidentes e limita lote a 500', async () => {
    const prisma: any = {
      orderGroup: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'og-1' }, { id: 'og-2' }]),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest
        .fn()
        .mockResolvedValueOnce({
          healthy: true,
          persistedIncidentCount: 0,
        })
        .mockResolvedValueOnce({
          healthy: false,
          persistedIncidentCount: 2,
        }),
    };

    const service = new FinancialReconciliationScanService(
      prisma,
      incidents,
    );

    await expect(service.scan(999)).resolves.toEqual({
      scanned: 2,
      healthy: 1,
      unhealthy: 1,
      failed: 0,
      persistedIncidentCount: 2,
    });

    expect(prisma.orderGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );

    expect(
      incidents.reconcileAndPersistOrderGroup,
    ).toHaveBeenCalledTimes(2);
  });

  it('continua o lote quando um OrderGroup falha', async () => {
    const prisma: any = {
      orderGroup: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'og-1' }, { id: 'og-2' }]),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest
        .fn()
        .mockRejectedValueOnce(new Error('falha simulada'))
        .mockResolvedValueOnce({
          healthy: true,
          persistedIncidentCount: 0,
        }),
    };

    const service = new FinancialReconciliationScanService(
      prisma,
      incidents,
    );

    const result = await service.scan(100);

    expect(result).toEqual({
      scanned: 2,
      healthy: 1,
      unhealthy: 0,
      failed: 1,
      persistedIncidentCount: 0,
    });
  });
});
