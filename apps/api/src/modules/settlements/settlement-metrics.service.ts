import { Injectable } from '@nestjs/common';
import {
  SellerSettlementStatus,
  SettlementBatchStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettlementMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot() {
    const now = new Date();
    const stuckCutoff = new Date(
      now.getTime() - 30 * 60 * 1000,
    );

    const [settlementRows, batchRows, stuck] =
      await Promise.all([
        this.prisma.sellerSettlement.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.settlementBatch.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.sellerSettlement.count({
          where: {
            status: SellerSettlementStatus.PAYOUT_PENDING,
            payoutRequestedAt: { lt: stuckCutoff },
          },
        }),
      ]);

    const settlements = Object.values(
      SellerSettlementStatus,
    ).reduce<Record<string, number>>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});

    for (const row of settlementRows) {
      settlements[row.status] = row._count._all;
    }

    const batches = Object.values(
      SettlementBatchStatus,
    ).reduce<Record<string, number>>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});

    for (const row of batchRows) {
      batches[row.status] = row._count._all;
    }

    return {
      generatedAt: now,
      settlements,
      batches,
      alerts: {
        stuckPayoutPending: stuck,
        failedSettlements:
          settlements[SellerSettlementStatus.FAILED] ?? 0,
      },
    };
  }
}
