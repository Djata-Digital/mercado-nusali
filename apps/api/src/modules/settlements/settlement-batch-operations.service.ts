import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SellerSettlementStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SettlementPayoutService } from './settlement-payout.service';

@Injectable()
export class SettlementBatchOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlementPayouts: SettlementPayoutService,
  ) {}

  async reconcileBatch(batchId: string) {
    const batch = await this.prisma.settlementBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('SettlementBatch não encontrado.');

    const settlements = await this.prisma.sellerSettlement.findMany({
      where: { batchId },
      orderBy: { sellerId: 'asc' },
    });

    let reconciled = 0;
    let failures = 0;
    const results: Array<{ settlementId: string; action: string; consistent: boolean }> = [];

    for (const settlement of settlements) {
      if (!settlement.payoutId) continue;
      try {
        const result = await this.settlementPayouts.reconcilePayout(settlement.id);
        reconciled += 1;
        results.push({
          settlementId: settlement.id,
          action: result.action,
          consistent: result.consistent,
        });
      } catch {
        failures += 1;
        results.push({ settlementId: settlement.id, action: 'ERROR', consistent: false });
      }
    }

    return { batchId, scanned: settlements.length, reconciled, failures, results };
  }

  async finalizationStatus(batchId: string) {
    const batch = await this.prisma.settlementBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('SettlementBatch não encontrado.');

    const rows = await this.prisma.sellerSettlement.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
    const nonTerminal = rows
      .filter(
      (row) =>
        row.status !== SellerSettlementStatus.SETTLED &&
        row.status !== SellerSettlementStatus.FAILED,
    )
      .reduce((sum, row) => sum + row._count._all, 0);
    const failed = counts[SellerSettlementStatus.FAILED] ?? 0;

    return {
      batchId,
      batchStatus: batch.status,
      finalizable: nonTerminal === 0,
      healthyFinalization: nonTerminal === 0 && failed === 0,
      blockers: nonTerminal > 0 ? ['NON_TERMINAL_SETTLEMENTS'] : [],
      counts,
    };
  }

  async report(batchId: string) {
    const batch = await this.prisma.settlementBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('SettlementBatch não encontrado.');

    const settlements = await this.prisma.sellerSettlement.findMany({
      where: { batchId },
      orderBy: { sellerId: 'asc' },
      select: {
        id: true, sellerId: true, status: true, grossAmount: true,
        platformFee: true, adjustments: true, payoutAmount: true, payoutId: true,
      },
    });

    const totals = settlements.reduce((acc, row) => ({
      grossAmount: acc.grossAmount.plus(row.grossAmount),
      platformFee: acc.platformFee.plus(row.platformFee),
      adjustments: acc.adjustments.plus(row.adjustments),
      payoutAmount: acc.payoutAmount.plus(row.payoutAmount),
    }), {
      grossAmount: new Prisma.Decimal(0), platformFee: new Prisma.Decimal(0),
      adjustments: new Prisma.Decimal(0), payoutAmount: new Prisma.Decimal(0),
    });

    const byStatus: Record<string, number> = {};
    for (const row of settlements) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;

    return {
      batch: {
        id: batch.id, periodStart: batch.periodStart, periodEnd: batch.periodEnd,
        currencyId: batch.currencyId, status: batch.status, closedAt: batch.closedAt,
      },
      totals: {
        grossAmount: totals.grossAmount.toString(),
        platformFee: totals.platformFee.toString(),
        adjustments: totals.adjustments.toString(),
        payoutAmount: totals.payoutAmount.toString(),
      },
      byStatus,
      settlements: settlements.map((row) => ({
        ...row,
        grossAmount: row.grossAmount.toString(),
        platformFee: row.platformFee.toString(),
        adjustments: row.adjustments.toString(),
        payoutAmount: row.payoutAmount.toString(),
      })),
    };
  }
}
