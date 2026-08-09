import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  RECONCILE_STALE_REFUNDS_JOB,
  REFUND_RECONCILIATION_QUEUE,
} from './refund-reconciliation.processor';

const REFUND_RECONCILIATION_JOB_ID =
  'refund-reconciliation-scheduler';

@Injectable()
export class RefundReconciliationScheduler implements OnModuleInit {
  private readonly logger = new Logger(RefundReconciliationScheduler.name);

  constructor(
    @InjectQueue(REFUND_RECONCILIATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    try {
      await this.registerRepeatableJob();
      this.logger.log(
        `Job ${RECONCILE_STALE_REFUNDS_JOB} registrado a cada ${this.getIntervalMs()}ms.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Não foi possível registrar o job de reconciliation de refunds: ${message}`,
      );
    }
  }

  async registerRepeatableJob() {
    await this.queue.add(
      RECONCILE_STALE_REFUNDS_JOB,
      { limit: this.getBatchLimit() },
      {
        jobId: REFUND_RECONCILIATION_JOB_ID,
        repeat: {
          every: this.getIntervalMs(),
        },
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5_000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  private getIntervalMs() {
    const parsed = Number(
      process.env.REFUND_RECONCILIATION_INTERVAL_MS ?? '60000',
    );
    return Number.isFinite(parsed) && parsed >= 10_000 ? parsed : 60_000;
  }

  private getBatchLimit() {
    const parsed = Number(
      process.env.REFUND_RECONCILIATION_BATCH_LIMIT ?? '50',
    );
    return Number.isInteger(parsed) && parsed > 0
      ? Math.min(parsed, 200)
      : 50;
  }
}
