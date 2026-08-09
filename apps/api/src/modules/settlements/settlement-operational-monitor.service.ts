import { Injectable, Logger } from '@nestjs/common';
import { SellerSettlementStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type SettlementOperationalAlert = {
  code:
    | 'STUCK_PAYOUT_PENDING'
    | 'FAILED_SETTLEMENTS'
    | 'STALE_READY_SETTLEMENTS';
  severity: 'WARNING' | 'CRITICAL';
  count: number;
  message: string;
};

@Injectable()
export class SettlementOperationalMonitorService {
  private readonly logger = new Logger(
    SettlementOperationalMonitorService.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  async scan(): Promise<{
    scannedAt: Date;
    alerts: SettlementOperationalAlert[];
  }> {
    const now = new Date();
    const pendingCutoff = new Date(
      now.getTime() - 30 * 60 * 1000,
    );
    const readyCutoff = new Date(
      now.getTime() - 60 * 60 * 1000,
    );

    const [stuckPending, failed, staleReady] =
      await Promise.all([
        this.prisma.sellerSettlement.count({
          where: {
            status:
              SellerSettlementStatus.PAYOUT_PENDING,
            payoutRequestedAt: { lt: pendingCutoff },
          },
        }),
        this.prisma.sellerSettlement.count({
          where: {
            status: SellerSettlementStatus.FAILED,
          },
        }),
        this.prisma.sellerSettlement.count({
          where: {
            status: SellerSettlementStatus.READY,
            updatedAt: { lt: readyCutoff },
          },
        }),
      ]);

    const alerts: SettlementOperationalAlert[] = [];

    if (stuckPending > 0) {
      alerts.push({
        code: 'STUCK_PAYOUT_PENDING',
        severity: 'CRITICAL',
        count: stuckPending,
        message:
          'Há settlements PAYOUT_PENDING acima de 30 minutos.',
      });
    }

    if (failed > 0) {
      alerts.push({
        code: 'FAILED_SETTLEMENTS',
        severity: 'CRITICAL',
        count: failed,
        message:
          'Há settlements FAILED aguardando análise/recovery.',
      });
    }

    if (staleReady > 0) {
      alerts.push({
        code: 'STALE_READY_SETTLEMENTS',
        severity: 'WARNING',
        count: staleReady,
        message:
          'Há settlements READY sem solicitação de payout há mais de 60 minutos.',
      });
    }

    for (const alert of alerts) {
      const line = `[${alert.code}] ${alert.message} count=${alert.count}`;
      if (alert.severity === 'CRITICAL') {
        this.logger.error(line);
      } else {
        this.logger.warn(line);
      }
    }

    return { scannedAt: now, alerts };
  }
}
