import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayoutStatus,
  Prisma,
  SellerSettlementStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SettlementBatchOperationsService } from './settlement-batch-operations.service';
import { SettlementPayoutService } from './settlement-payout.service';

export type SettlementAdminContext = {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

@Injectable()
export class SettlementRecoveryAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementPayouts: SettlementPayoutService,
    private readonly batchOperations: SettlementBatchOperationsService,
  ) {}

  async reconcileSettlementWithAudit(
    settlementId: string,
    context: SettlementAdminContext,
    note?: string,
  ) {
    const before = await this.prisma.sellerSettlement.findUnique({
      where: { id: settlementId },
    });

    if (!before) {
      throw new NotFoundException(
        'Settlement do vendedor não encontrado.',
      );
    }

    try {
      const result =
        await this.settlementPayouts.reconcilePayout(
          settlementId,
        );

      const after =
        await this.prisma.sellerSettlement.findUnique({
          where: { id: settlementId },
        });

      await this.writeAudit({
        context,
        action: 'SETTLEMENT_PAYOUT_RECONCILE',
        entity: 'SellerSettlement',
        entityId: settlementId,
        previousValue: this.settlementSnapshot(before),
        newValue: {
          success: true,
          result,
          settlement: after
            ? this.settlementSnapshot(after)
            : null,
          note: note ?? null,
        },
      });

      return result;
    } catch (error) {
      await this.writeAudit({
        context,
        action: 'SETTLEMENT_PAYOUT_RECONCILE_FAILED',
        entity: 'SellerSettlement',
        entityId: settlementId,
        previousValue: this.settlementSnapshot(before),
        newValue: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'UNKNOWN_SETTLEMENT_RECONCILIATION_ERROR',
          note: note ?? null,
        },
      });

      throw error;
    }
  }

  async reconcileBatchWithAudit(
    batchId: string,
    context: SettlementAdminContext,
    note?: string,
  ) {
    const batch = await this.prisma.settlementBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException(
        'SettlementBatch não encontrado.',
      );
    }

    try {
      const result =
        await this.batchOperations.reconcileBatch(batchId);

      await this.writeAudit({
        context,
        action: 'SETTLEMENT_BATCH_RECONCILE',
        entity: 'SettlementBatch',
        entityId: batchId,
        previousValue: {
          status: batch.status,
          closedAt: batch.closedAt,
        },
        newValue: {
          success: true,
          result,
          note: note ?? null,
        },
      });

      return result;
    } catch (error) {
      await this.writeAudit({
        context,
        action: 'SETTLEMENT_BATCH_RECONCILE_FAILED',
        entity: 'SettlementBatch',
        entityId: batchId,
        previousValue: {
          status: batch.status,
          closedAt: batch.closedAt,
        },
        newValue: {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'UNKNOWN_BATCH_RECONCILIATION_ERROR',
          note: note ?? null,
        },
      });

      throw error;
    }
  }

  async prepareRetry(
    settlementId: string,
    context: SettlementAdminContext,
    note?: string,
  ) {
    const before = await this.prisma.sellerSettlement.findUnique({
      where: { id: settlementId },
      include: { payout: true },
    });

    if (!before) {
      throw new NotFoundException(
        'Settlement do vendedor não encontrado.',
      );
    }

    if (
      before.status === SellerSettlementStatus.READY &&
      !before.payoutId
    ) {
      return {
        idempotent: true,
        settlement: before,
      };
    }

    if (before.status !== SellerSettlementStatus.FAILED) {
      throw new ConflictException(
        'Somente settlements FAILED podem ser preparados para retry.',
      );
    }

    if (!before.payoutId || !before.payout) {
      throw new ConflictException(
        'Settlement FAILED não possui payout terminal vinculado para validar o retry.',
      );
    }

    if (
      before.payout.status !== PayoutStatus.FAILED &&
      before.payout.status !== PayoutStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Retry só é permitido quando o payout anterior está FAILED ou CANCELLED.',
      );
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.sellerSettlement.updateMany({
          where: {
            id: settlementId,
            status: SellerSettlementStatus.FAILED,
            payoutId: before.payoutId,
          },
          data: {
            status: SellerSettlementStatus.READY,
            payoutId: null,
            payoutRequestedAt: null,
            settledAt: null,
          },
        });

        if (claimed.count !== 1) {
          throw new ConflictException(
            'Settlement foi alterado por outra operação durante o recovery.',
          );
        }

        return tx.sellerSettlement.findUniqueOrThrow({
          where: { id: settlementId },
        });
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.writeAudit({
      context,
      action: 'SETTLEMENT_PREPARE_RETRY',
      entity: 'SellerSettlement',
      entityId: settlementId,
      previousValue: {
        ...this.settlementSnapshot(before),
        previousPayoutStatus: before.payout.status,
      },
      newValue: {
        success: true,
        settlement: this.settlementSnapshot(updated),
        previousPayoutId: before.payoutId,
        note: note ?? null,
      },
    });

    return {
      idempotent: false,
      previousPayoutId: before.payoutId,
      settlement: updated,
    };
  }

  async settlementHistory(
    settlementId: string,
    limit = 100,
  ) {
    const exists =
      await this.prisma.sellerSettlement.findUnique({
        where: { id: settlementId },
        select: { id: true },
      });

    if (!exists) {
      throw new NotFoundException(
        'Settlement do vendedor não encontrado.',
      );
    }

    return this.prisma.auditLog.findMany({
      where: {
        entity: 'SellerSettlement',
        entityId: settlementId,
        action: {
          startsWith: 'SETTLEMENT_',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: this.safeLimit(limit),
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

  async batchHistory(batchId: string, limit = 100) {
    const exists =
      await this.prisma.settlementBatch.findUnique({
        where: { id: batchId },
        select: { id: true },
      });

    if (!exists) {
      throw new NotFoundException(
        'SettlementBatch não encontrado.',
      );
    }

    return this.prisma.auditLog.findMany({
      where: {
        entity: 'SettlementBatch',
        entityId: batchId,
        action: {
          startsWith: 'SETTLEMENT_BATCH_',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: this.safeLimit(limit),
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

  private settlementSnapshot(settlement: {
    status: SellerSettlementStatus;
    payoutId: string | null;
    payoutRequestedAt: Date | null;
    settledAt: Date | null;
    payoutAmount: Prisma.Decimal;
    adjustments: Prisma.Decimal;
  }) {
    return {
      status: settlement.status,
      payoutId: settlement.payoutId,
      payoutRequestedAt: settlement.payoutRequestedAt,
      settledAt: settlement.settledAt,
      payoutAmount: settlement.payoutAmount.toString(),
      adjustments: settlement.adjustments.toString(),
    };
  }

  private async writeAudit(input: {
    context: SettlementAdminContext;
    action: string;
    entity: string;
    entityId: string;
    previousValue: unknown;
    newValue: unknown;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId:
          input.context.actorId &&
          input.context.actorId !== 'system'
            ? input.context.actorId
            : null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        previousValue: this.safeJson(input.previousValue),
        newValue: this.safeJson(input.newValue),
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
        requestId: input.context.requestId,
      },
    });
  }

  private safeLimit(limit: number) {
    return Math.min(Math.max(limit, 1), 500);
  }

  private safeJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(value),
    ) as Prisma.InputJsonValue;
  }
}
