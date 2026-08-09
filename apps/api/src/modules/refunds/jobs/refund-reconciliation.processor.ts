import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { RefundAlertsService } from '../services/refund-alerts.service';
import { RefundReconciliationService } from '../services/refund-reconciliation.service';

export const REFUND_RECONCILIATION_QUEUE = 'refund-reconciliation';
export const RECONCILE_STALE_REFUNDS_JOB = 'reconcile-stale-refunds';

export type RefundReconciliationJobData = {
  limit?: number;
};

@Processor(REFUND_RECONCILIATION_QUEUE)
@Injectable()
export class RefundReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(RefundReconciliationProcessor.name);

  constructor(
    private readonly reconciliation: RefundReconciliationService,
    private readonly alerts: RefundAlertsService,
  ) {
    super();
  }

  async process(job: Job<RefundReconciliationJobData>) {
    const startedAt = Date.now();
    const limit = this.normalizeLimit(job.data?.limit);

    this.logger.log(
      `Executando ${job.name} (${job.id ?? 'sem-id'}) para até ${limit} refunds.`,
    );

    const result = await this.reconciliation.reconcileStaleProcessing(limit);
    const alertState = await this.alerts.evaluate();

    const durationMs = Date.now() - startedAt;

    if (!alertState.healthy) {
      this.logger.error(
        `Refund reconciliation terminou com alerta CRITICAL: ${JSON.stringify(
          alertState.alerts,
        )}`,
      );
    } else if (alertState.alerts.length > 0) {
      this.logger.warn(
        `Refund reconciliation terminou com alertas: ${JSON.stringify(
          alertState.alerts,
        )}`,
      );
    }

    return {
      reconciliation: result,
      alerts: alertState.alerts,
      durationMs,
    };
  }

  private normalizeLimit(value?: number) {
    if (!Number.isInteger(value) || !value || value <= 0) return 50;
    return Math.min(value, 200);
  }
}
