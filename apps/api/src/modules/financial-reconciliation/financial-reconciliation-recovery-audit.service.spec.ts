import { FinancialReconciliationRecoveryAuditService } from './financial-reconciliation-recovery-audit.service';

describe('FinancialReconciliationRecoveryAuditService - Sprint 7.5.6', () => {
  function build() {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const recovery: any = {
      execute: jest.fn(),
    };

    return {
      prisma,
      recovery,
      service: new FinancialReconciliationRecoveryAuditService(
        prisma,
        recovery,
      ),
    };
  }

  it('registra before/after de recovery bem-sucedido', async () => {
    const { service, prisma, recovery } = build();

    prisma.financialReconciliationIncident.findUnique
      .mockResolvedValueOnce({
        id: 'inc-1',
        status: 'OPEN',
        occurrenceCount: 2,
        resolvedAt: null,
        resolutionNote: null,
      })
      .mockResolvedValueOnce({
        id: 'inc-1',
        status: 'RESOLVED',
        occurrenceCount: 2,
      });

    recovery.execute.mockResolvedValue({
      healthy: true,
      resolved: true,
      idempotent: false,
    });

    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await service.executeWithAudit(
      'inc-1',
      'AUTO_RESOLVE_IF_HEALTHY',
      {
        actorId: 'admin-1',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        requestId: 'req-1',
      },
      'validado',
    );

    expect(result.resolved).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin-1',
          action:
            'FINANCIAL_RECONCILIATION_RECOVERY_AUTO_RESOLVE_IF_HEALTHY',
          entity: 'FinancialReconciliationIncident',
          entityId: 'inc-1',
          requestId: 'req-1',
        }),
      }),
    );
  });

  it('registra tentativa falha antes de propagar o erro', async () => {
    const { service, prisma, recovery } = build();

    prisma.financialReconciliationIncident.findUnique.mockResolvedValue({
      id: 'inc-1',
      status: 'OPEN',
      occurrenceCount: 1,
    });

    recovery.execute.mockRejectedValue(
      new Error('recovery failed'),
    );

    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(
      service.executeWithAudit(
        'inc-1',
        'RECHECK',
        { actorId: 'admin-1' },
      ),
    ).rejects.toThrow('recovery failed');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'FINANCIAL_RECONCILIATION_RECOVERY_RECHECK_FAILED',
        }),
      }),
    );
  });

  it('histórico usa limite máximo de 500', async () => {
    const { service, prisma } = build();

    prisma.financialReconciliationIncident.findUnique.mockResolvedValue({
      id: 'inc-1',
    });
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.history('inc-1', 9999);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });

  it('actor system não é gravado como FK de usuário', async () => {
    const { service, prisma, recovery } = build();

    prisma.financialReconciliationIncident.findUnique
      .mockResolvedValueOnce({
        id: 'inc-1',
        status: 'OPEN',
        occurrenceCount: 1,
      })
      .mockResolvedValueOnce({
        id: 'inc-1',
        status: 'OPEN',
        occurrenceCount: 1,
      });

    recovery.execute.mockResolvedValue({
      healthy: false,
      resolved: false,
    });

    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await service.executeWithAudit(
      'inc-1',
      'RECHECK',
      { actorId: 'system' },
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: null }),
      }),
    );
  });
});
