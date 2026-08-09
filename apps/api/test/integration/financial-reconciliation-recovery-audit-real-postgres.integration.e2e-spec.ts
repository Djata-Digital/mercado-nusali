import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { FinancialReconciliationIncidentsService } from '../../src/modules/financial-reconciliation/financial-reconciliation-incidents.service';
import { FinancialReconciliationRecoveryService } from '../../src/modules/financial-reconciliation/financial-reconciliation-recovery.service';
import { FinancialReconciliationRecoveryAuditService } from '../../src/modules/financial-reconciliation/financial-reconciliation-recovery-audit.service';
import { FinancialReconciliationService } from '../../src/modules/financial-reconciliation/financial-reconciliation.service';

describe('Sprint 7.5.7 - Financial Reconciliation Recovery & Audit Real PostgreSQL', () => {
  jest.setTimeout(120000);

  const dbUrlTest = process.env.DATABASE_URL_TEST || '';
  let prisma: PrismaService;
  let raw: PrismaClient;
  let recoveryAudit: FinancialReconciliationRecoveryAuditService;

  beforeAll(async () => {
    if (!dbUrlTest) {
      throw new Error('DATABASE_URL_TEST é obrigatória para a Sprint 7.5.7.');
    }
    if (!dbUrlTest.includes('_test')) {
      throw new Error(
        `Segurança de Dados: DATABASE_URL_TEST ("${dbUrlTest}") deve conter "_test".`,
      );
    }

    prisma = new PrismaService({
      datasources: { db: { url: dbUrlTest } },
    } as any);
    raw = prisma as unknown as PrismaClient;
    await prisma.$connect();

    const reconciliation = new FinancialReconciliationService(prisma);
    const incidents = new FinancialReconciliationIncidentsService(
      prisma,
      reconciliation,
    );
    const recovery = new FinancialReconciliationRecoveryService(
      prisma,
      incidents,
    );
    recoveryAudit = new FinancialReconciliationRecoveryAuditService(
      prisma,
      recovery,
    );
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  async function createResolvedIncident() {
    const token = crypto.randomUUID();
    return raw.financialReconciliationIncident.create({
      data: {
        fingerprint: `sprint-7.5.7-${token}`,
        orderGroupId: `og-resolved-${token}`,
        code: 'TEST_ALREADY_RESOLVED',
        severity: 'WARNING',
        status: 'RESOLVED',
        expectedValue: '100.00',
        actualValue: '100.00',
        occurrenceCount: 1,
        resolvedAt: new Date(),
        resolvedBy: 'system',
        resolutionNote: 'Fixture isolada da Sprint 7.5.7',
      },
    });
  }

  it('1. recovery idempotente em incidente RESOLVED persiste AuditLog real', async () => {
    const incident = await createResolvedIncident();
    const requestId = `req-${crypto.randomUUID()}`;

    const result = await recoveryAudit.executeWithAudit(
      incident.id,
      'RECHECK',
      {
        actorId: 'system',
        ipAddress: '127.0.0.1',
        userAgent: 'jest-integration',
        requestId,
      },
      'recheck idempotente',
    );

    expect(result.idempotent).toBe(true);

    const audit = await raw.auditLog.findFirst({
      where: {
        entity: 'FinancialReconciliationIncident',
        entityId: incident.id,
        requestId,
      },
    });

    expect(audit).not.toBeNull();
    expect(audit?.action).toBe('FINANCIAL_RECONCILIATION_RECOVERY_RECHECK');
    expect(audit?.userId).toBeNull();
    expect(audit?.ipAddress).toBe('127.0.0.1');
    expect(audit?.userAgent).toBe('jest-integration');
  });

  it('2. histórico lê do PostgreSQL e devolve o evento mais recente primeiro', async () => {
    const incident = await createResolvedIncident();

    await recoveryAudit.executeWithAudit(
      incident.id,
      'RECHECK',
      { actorId: 'system', requestId: `first-${crypto.randomUUID()}` },
      'primeiro',
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    await recoveryAudit.executeWithAudit(
      incident.id,
      'AUTO_RESOLVE_IF_HEALTHY',
      { actorId: 'system', requestId: `second-${crypto.randomUUID()}` },
      'segundo',
    );

    const history = await recoveryAudit.history(incident.id, 100);

    expect(history).toHaveLength(2);
    expect(history[0].action).toBe(
      'FINANCIAL_RECONCILIATION_RECOVERY_AUTO_RESOLVE_IF_HEALTHY',
    );
    expect(history[1].action).toBe(
      'FINANCIAL_RECONCILIATION_RECOVERY_RECHECK',
    );
  });

  it('3. chamadas repetidas preservam idempotência financeira e auditam cada tentativa', async () => {
    const incident = await createResolvedIncident();

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        recoveryAudit.executeWithAudit(
          incident.id,
          'RECHECK',
          {
            actorId: 'system',
            requestId: `parallel-${index}-${crypto.randomUUID()}`,
          },
        ),
      ),
    );

    expect(results.every((result) => result.idempotent === true)).toBe(true);

    const persisted = await raw.financialReconciliationIncident.findUnique({
      where: { id: incident.id },
    });
    expect(persisted?.status).toBe('RESOLVED');

    const audits = await raw.auditLog.count({
      where: {
        entity: 'FinancialReconciliationIncident',
        entityId: incident.id,
        action: 'FINANCIAL_RECONCILIATION_RECOVERY_RECHECK',
      },
    });
    expect(audits).toBe(5);
  });

  it('4. falha de recovery é auditada no PostgreSQL antes de ser propagada', async () => {
    const token = crypto.randomUUID();
    const incident = await raw.financialReconciliationIncident.create({
      data: {
        fingerprint: `sprint-7.5.7-failure-${token}`,
        orderGroupId: `missing-og-${token}`,
        code: 'TEST_FAILURE_PATH',
        severity: 'CRITICAL',
        status: 'OPEN',
        expectedValue: '100.00',
        actualValue: '90.00',
      },
    });

    const requestId = `failed-${crypto.randomUUID()}`;

    await expect(
      recoveryAudit.executeWithAudit(
        incident.id,
        'RECHECK',
        { actorId: 'system', requestId },
        'falha esperada de fixture',
      ),
    ).rejects.toBeDefined();

    const audit = await raw.auditLog.findFirst({
      where: {
        entity: 'FinancialReconciliationIncident',
        entityId: incident.id,
        requestId,
      },
    });

    expect(audit).not.toBeNull();
    expect(audit?.action).toBe(
      'FINANCIAL_RECONCILIATION_RECOVERY_RECHECK_FAILED',
    );

    const persisted = await raw.financialReconciliationIncident.findUnique({
      where: { id: incident.id },
    });
    expect(persisted?.status).toBe('OPEN');
  });

  it('5. limit do histórico é respeitado contra PostgreSQL real', async () => {
    const incident = await createResolvedIncident();

    for (let i = 0; i < 3; i += 1) {
      await recoveryAudit.executeWithAudit(
        incident.id,
        'RECHECK',
        {
          actorId: 'system',
          requestId: `limit-${i}-${crypto.randomUUID()}`,
        },
      );
    }

    const history = await recoveryAudit.history(incident.id, 2);
    expect(history).toHaveLength(2);
  });
});
