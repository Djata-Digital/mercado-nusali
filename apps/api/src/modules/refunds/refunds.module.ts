import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { EscrowModule } from '../escrow/escrow.module';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentGatewayErrorClassifierService } from '../payments/services/payment-gateway-error-classifier.service';
import { PaymentProviderTimeoutService } from '../payments/services/payment-provider-timeout.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RefundProviderWebhookController } from './refund-provider-webhook.controller';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RefundProviderExecutionService } from './services/refund-provider-execution.service';
import { RefundProviderWebhookService } from './services/refund-provider-webhook.service';
import { RefundReconciliationService } from './services/refund-reconciliation.service';
import { RefundOperationsService } from './services/refund-operations.service';
import { RefundMetricsService } from './services/refund-metrics.service';
import { RefundAlertsService } from './services/refund-alerts.service';
import { RefundAuditReportService } from './services/refund-audit-report.service';
import {
  REFUND_RECONCILIATION_QUEUE,
  RefundReconciliationProcessor,
} from './jobs/refund-reconciliation.processor';
import { RefundReconciliationScheduler } from './jobs/refund-reconciliation.scheduler';
import { RefundTransactionService } from './services/refund-transaction.service';

const bullMqWorkersEnabled =
  process.env.DISABLE_BULLMQ_WORKERS !== 'true';

@Module({
  imports: [
    PrismaModule,
    EscrowModule,
    PaymentsModule,
    ...(bullMqWorkersEnabled
      ? [BullModule.registerQueue({ name: REFUND_RECONCILIATION_QUEUE })]
      : []),
  ],
  controllers: [
    RefundsController,
    RefundProviderWebhookController,
  ],
  providers: [
    RefundsService,
    RefundTransactionService,
    RefundProviderExecutionService,
    RefundProviderWebhookService,
    RefundReconciliationService,
    RefundOperationsService,
    RefundMetricsService,
    RefundAlertsService,
    RefundAuditReportService,
    ...(bullMqWorkersEnabled
      ? [RefundReconciliationProcessor, RefundReconciliationScheduler]
      : []),
    PaymentProviderTimeoutService,
    PaymentGatewayErrorClassifierService,
  ],
  exports: [
    RefundsService,
    RefundProviderExecutionService,
    RefundReconciliationService,
    RefundOperationsService,
    RefundMetricsService,
    RefundAlertsService,
    RefundAuditReportService,
    ...(bullMqWorkersEnabled
      ? [RefundReconciliationProcessor, RefundReconciliationScheduler]
      : []),
  ],
})
export class RefundsModule {}
