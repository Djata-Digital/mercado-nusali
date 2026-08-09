import { Module } from '@nestjs/common';

import { PayoutsModule } from '../payouts/payouts.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SettlementBatchOperationsService } from './settlement-batch-operations.service';
import { SettlementPayoutService } from './settlement-payout.service';
import { SettlementRecoveryAuditService } from './settlement-recovery-audit.service';
import { SettlementReadinessService } from './settlement-readiness.service';
import { SettlementOperationalMonitorService } from './settlement-operational-monitor.service';
import { SettlementMetricsService } from './settlement-metrics.service';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

@Module({
  imports: [PrismaModule, PayoutsModule],
  controllers: [SettlementsController],
  providers: [
    SettlementsService,
    SettlementPayoutService,
    SettlementBatchOperationsService,
    SettlementRecoveryAuditService,
    SettlementReadinessService,
    SettlementMetricsService,
    SettlementOperationalMonitorService,
  ],
  exports: [
    SettlementsService,
    SettlementPayoutService,
    SettlementBatchOperationsService,
    SettlementRecoveryAuditService,
  ],
})
export class SettlementsModule {}
