import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FinancialReconciliationRecoveryService } from './financial-reconciliation-recovery.service';

describe('FinancialReconciliationRecoveryService - Sprint 7.5.5', () => {
  const incident = {
    id: 'inc-1',
    orderGroupId: 'og-1',
    status: 'OPEN',
  };

  it('faz RECHECK sem alterar dinheiro automaticamente', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(incident),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest.fn().mockResolvedValue({
        healthy: false,
        persistedIncidentCount: 1,
      }),
      resolve: jest.fn(),
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      incidents,
    );

    const result = await service.execute(
      'inc-1',
      'RECHECK',
      'admin-1',
    );

    expect(result.healthy).toBe(false);
    expect(result.resolved).toBe(false);
    expect(incidents.resolve).not.toHaveBeenCalled();
  });

  it('AUTO_RESOLVE_IF_HEALTHY resolve somente após reconciliação saudável', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(incident),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest.fn().mockResolvedValue({
        healthy: true,
        persistedIncidentCount: 0,
      }),
      resolve: jest.fn().mockResolvedValue({
        ...incident,
        status: 'RESOLVED',
      }),
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      incidents,
    );

    const result = await service.execute(
      'inc-1',
      'AUTO_RESOLVE_IF_HEALTHY',
      'admin-1',
      'validado',
    );

    expect(result.healthy).toBe(true);
    expect(result.resolved).toBe(true);
    expect(incidents.resolve).toHaveBeenCalledWith(
      'inc-1',
      'admin-1',
      'validado',
    );
  });

  it('não resolve automaticamente quando divergência continua', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(incident),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest.fn().mockResolvedValue({
        healthy: false,
        persistedIncidentCount: 1,
      }),
      resolve: jest.fn(),
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      incidents,
    );

    const result = await service.execute(
      'inc-1',
      'AUTO_RESOLVE_IF_HEALTHY',
      'admin-1',
    );

    expect(result.resolved).toBe(false);
    expect(incidents.resolve).not.toHaveBeenCalled();
  });

  it('é idempotente para incidente já resolvido', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue({
          ...incident,
          status: 'RESOLVED',
        }),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest.fn(),
      resolve: jest.fn(),
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      incidents,
    );

    const result = await service.execute(
      'inc-1',
      'RECHECK',
      'admin-1',
    );

    expect(result.idempotent).toBe(true);
    expect(
      incidents.reconcileAndPersistOrderGroup,
    ).not.toHaveBeenCalled();
  });

  it('rejeita incidente inexistente', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      {} as any,
    );

    await expect(
      service.execute('missing', 'RECHECK', 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita ação não suportada', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(incident),
      },
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      {} as any,
    );

    await expect(
      service.execute(
        'inc-1',
        'FORCE_LEDGER' as any,
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
