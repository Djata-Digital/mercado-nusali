import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FinancialReconciliationIncidentSeverity,
  FinancialReconciliationIncidentStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialReconciliationService } from './financial-reconciliation.service';

@Injectable()
export class FinancialReconciliationIncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: FinancialReconciliationService,
  ) {}

  async reconcileAndPersistOrderGroup(orderGroupId: string) {
    const report = await this.reconciliation.reconcileOrderGroup(orderGroupId);
    const active: string[] = [];

    for (const payment of report.payments) {
      for (const issue of payment.issues) {
        const fingerprint = createHash('sha256')
          .update(`${orderGroupId}:${payment.paymentId}:${issue.code}`)
          .digest('hex');
        active.push(fingerprint);

        await this.prisma.financialReconciliationIncident.upsert({
          where: { fingerprint },
          create: {
            fingerprint,
            paymentId: payment.paymentId,
            orderGroupId,
            code: issue.code,
            severity: this.severity(issue.code),
            expectedValue: issue.expected ?? null,
            actualValue: issue.actual ?? null,
            detailsJson: issue as unknown as Prisma.InputJsonValue,
          },
          update: {
            severity: this.severity(issue.code),
            expectedValue: issue.expected ?? null,
            actualValue: issue.actual ?? null,
            detailsJson: issue as unknown as Prisma.InputJsonValue,
            lastSeenAt: new Date(),
            occurrenceCount: { increment: 1 },
            status: FinancialReconciliationIncidentStatus.OPEN,
            resolvedAt: null,
            resolvedBy: null,
            resolutionNote: null,
          },
        });
      }
    }

    await this.prisma.financialReconciliationIncident.updateMany({
      where: {
        orderGroupId,
        status: { in: [
          FinancialReconciliationIncidentStatus.OPEN,
          FinancialReconciliationIncidentStatus.ACKNOWLEDGED,
        ]},
        ...(active.length ? { fingerprint: { notIn: active } } : {}),
      },
      data: {
        status: FinancialReconciliationIncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNote: 'AUTO_RESOLVED_BY_RECONCILIATION',
      },
    });

    return { ...report, persistedIncidentCount: active.length };
  }

  async list(take = 100) {
    return this.prisma.financialReconciliationIncident.findMany({
      orderBy: [{ severity: 'desc' }, { lastSeenAt: 'desc' }],
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  async acknowledge(id: string, actorId: string) {
    await this.requireIncident(id);
    return this.prisma.financialReconciliationIncident.update({
      where: { id },
      data: {
        status: FinancialReconciliationIncidentStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedBy: actorId,
      },
    });
  }

  async resolve(id: string, actorId: string, note: string) {
    await this.requireIncident(id);
    return this.prisma.financialReconciliationIncident.update({
      where: { id },
      data: {
        status: FinancialReconciliationIncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy: actorId,
        resolutionNote: note,
      },
    });
  }

  async summary() {
    return this.prisma.financialReconciliationIncident.groupBy({
      by: ['status', 'severity'],
      _count: { _all: true },
    });
  }

  private async requireIncident(id: string) {
    const incident = await this.prisma.financialReconciliationIncident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incidente de reconciliação não encontrado.');
    return incident;
  }

  private severity(code: string) {
    const critical = new Set([
      'REFUND_EXCEEDS_PAYMENT',
      'ESCROW_INVARIANT_BROKEN',
      'PAYOUT_EXCEEDS_RELEASED',
      'REFUND_LEDGER_MISMATCH',
      'PAYOUT_LEDGER_MISMATCH',
    ]);
    return critical.has(code)
      ? FinancialReconciliationIncidentSeverity.CRITICAL
      : FinancialReconciliationIncidentSeverity.WARNING;
  }
}
