import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { FinancialReconciliationAdminController } from './financial-reconciliation-admin.controller';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';
import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';
import { FinancialReconciliationReadinessService } from './financial-reconciliation-readiness.service';
import { FinancialReconciliationRecoveryAuditService } from './financial-reconciliation-recovery-audit.service';
import { FinancialReconciliationRecoveryService } from './financial-reconciliation-recovery.service';
import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';
import { FinancialReconciliationSchedulerService } from './financial-reconciliation-scheduler.service';
import { FinancialReconciliationService } from './financial-reconciliation.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialReconciliationAdminController],
  providers: [
    FinancialReconciliationService,
    FinancialReconciliationIncidentsService,
    FinancialReconciliationMetricsService,
    FinancialReconciliationScanService,
    FinancialReconciliationRecoveryService,
    FinancialReconciliationRecoveryAuditService,
    FinancialReconciliationSchedulerService,
    FinancialReconciliationReadinessService,
  ],
  exports: [
    FinancialReconciliationService,
    FinancialReconciliationIncidentsService,
    FinancialReconciliationMetricsService,
    FinancialReconciliationScanService,
    FinancialReconciliationRecoveryService,
    FinancialReconciliationRecoveryAuditService,
    FinancialReconciliationSchedulerService,
    FinancialReconciliationReadinessService,
  ],
})
export class FinancialReconciliationModule {}
