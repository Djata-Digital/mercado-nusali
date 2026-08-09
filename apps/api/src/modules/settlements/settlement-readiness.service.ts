import { Injectable } from '@nestjs/common';
import {
  SellerSettlementStatus,
  SettlementBatchStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettlementReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async status() {
    const now = new Date();
    const payoutPendingCutoff = new Date(
      now.getTime() - 30 * 60 * 1000,
    );
    const readyCutoff = new Date(
      now.getTime() - 60 * 60 * 1000,
    );

    const [
      dbHealthy,
      stuckPayoutPending,
      staleReady,
      failedSettlements,
      openBatches,
    ] = await Promise.all([
      this.databaseHealthy(),
      this.prisma.sellerSettlement.count({
        where: {
          status: SellerSettlementStatus.PAYOUT_PENDING,
          payoutRequestedAt: { lt: payoutPendingCutoff },
        },
      }),
      this.prisma.sellerSettlement.count({
        where: {
          status: SellerSettlementStatus.READY,
          updatedAt: { lt: readyCutoff },
        },
      }),
      this.prisma.sellerSettlement.count({
        where: {
          status: SellerSettlementStatus.FAILED,
        },
      }),
      this.prisma.settlementBatch.count({
        where: {
          status: SettlementBatchStatus.OPEN,
        },
      }),
    ]);

    const reasons: string[] = [];

    if (!dbHealthy) reasons.push('DATABASE_UNAVAILABLE');
    if (stuckPayoutPending > 0) {
      reasons.push('STUCK_PAYOUT_PENDING');
    }

    return {
      ready: reasons.length === 0,
      checkedAt: now,
      reasons,
      thresholds: {
        payoutPendingMinutes: 30,
        staleReadyMinutes: 60,
      },
      counters: {
        stuckPayoutPending,
        staleReady,
        failedSettlements,
        openBatches,
      },
    };
  }

  private async databaseHealthy() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
