import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  FinancialRecoveryAction,
  FinancialReconciliationRecoveryService,
} from './financial-reconciliation-recovery.service';

export type FinancialRecoveryRequestContext = {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

@Injectable()
export class FinancialReconciliationRecoveryAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recovery: FinancialReconciliationRecoveryService,
  ) {}

  async executeWithAudit(
    incidentId: string,
    action: FinancialRecoveryAction,
    context: FinancialRecoveryRequestContext,
    note?: string,
  ) {
    const before =
      await this.prisma.financialReconciliationIncident.findUnique({
        where: { id: incidentId },
      });

    if (!before) {
      throw new NotFoundException('Incidente financeiro não encontrado.');
    }

    try {
      const result = await this.recovery.execute(
        incidentId,
        action,
        context.actorId,
        note,
      );

      const after =
        await this.prisma.financialReconciliationIncident.findUnique({
          where: { id: incidentId },
        });

      await this.prisma.auditLog.create({
        data: {
          userId:
            context.actorId && context.actorId !== 'system'
              ? context.actorId
              : null,
          action: `FINANCIAL_RECONCILIATION_RECOVERY_${action}`,
          entity: 'FinancialReconciliationIncident',
          entityId: incidentId,
          previousValue: this.safeJson({
            status: before.status,
            occurrenceCount: before.occurrenceCount,
            resolvedAt: before.resolvedAt,
            resolutionNote: before.resolutionNote,
          }),
          newValue: this.safeJson({
            success: true,
            idempotent: Boolean((result as any)?.idempotent),
            result,
            status: after?.status ?? before.status,
            note: note ?? null,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.auditLog.create({
        data: {
          userId:
            context.actorId && context.actorId !== 'system'
              ? context.actorId
              : null,
          action: `FINANCIAL_RECONCILIATION_RECOVERY_${action}_FAILED`,
          entity: 'FinancialReconciliationIncident',
          entityId: incidentId,
          previousValue: this.safeJson({
            status: before.status,
            occurrenceCount: before.occurrenceCount,
          }),
          newValue: this.safeJson({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'UNKNOWN_RECOVERY_ERROR',
            note: note ?? null,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
        },
      });

      throw error;
    }
  }

  async history(incidentId: string, limit = 100) {
    const exists =
      await this.prisma.financialReconciliationIncident.findUnique({
        where: { id: incidentId },
        select: { id: true },
      });

    if (!exists) {
      throw new NotFoundException('Incidente financeiro não encontrado.');
    }

    return this.prisma.auditLog.findMany({
      where: {
        entity: 'FinancialReconciliationIncident',
        entityId: incidentId,
        action: {
          startsWith: 'FINANCIAL_RECONCILIATION_RECOVERY_',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      select: {
        id: true,
        userId: true,
        action: true,
        entity: true,
        entityId: true,
        previousValue: true,
        newValue: true,
        ipAddress: true,
        userAgent: true,
        requestId: true,
        createdAt: true,
      },
    });
  }

  private safeJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
