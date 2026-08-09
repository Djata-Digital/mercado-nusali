import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';

export type FinancialReconciliationSchedulerStatus = {
  enabled: boolean;
  running: boolean;
  totalRuns: number;
  skippedOverlaps: number;
  consecutiveFailures: number;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  intervalMs: number;
  batchSize: number;
};

@Injectable()
export class FinancialReconciliationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(
    FinancialReconciliationSchedulerService.name,
  );

  private timer?: NodeJS.Timeout;
  private running = false;
  private totalRuns = 0;
  private skippedOverlaps = 0;
  private consecutiveFailures = 0;
  private lastStartedAt: Date | null = null;
  private lastFinishedAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;

  constructor(private readonly scans: FinancialReconciliationScanService) {}

  onModuleInit() {
    if (!this.isEnabled()) return;

    const intervalMs = this.getIntervalMs();

    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);

    this.timer.unref?.();
  }

  async runOnce() {
    if (this.running) {
      this.skippedOverlaps += 1;
      this.logger.warn(
        'Scan financeiro ignorado porque uma execução anterior ainda está ativa.',
      );
      return {
        skipped: true,
        reason: 'PREVIOUS_RUN_STILL_ACTIVE',
      };
    }

    this.running = true;
    this.totalRuns += 1;
    this.lastStartedAt = new Date();

    try {
      const result = await this.scans.scan(this.getBatchSize());

      this.consecutiveFailures = 0;
      this.lastError = null;
      this.lastSuccessAt = new Date();

      return {
        skipped: false,
        result,
      };
    } catch (error) {
      this.consecutiveFailures += 1;
      this.lastError =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Falha no scan financeiro agendado: ${this.lastError}`,
      );

      throw error;
    } finally {
      this.lastFinishedAt = new Date();
      this.running = false;
    }
  }

  getStatus(): FinancialReconciliationSchedulerStatus {
    return {
      enabled: this.isEnabled(),
      running: this.running,
      totalRuns: this.totalRuns,
      skippedOverlaps: this.skippedOverlaps,
      consecutiveFailures: this.consecutiveFailures,
      lastStartedAt: this.lastStartedAt,
      lastFinishedAt: this.lastFinishedAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      intervalMs: this.getIntervalMs(),
      batchSize: this.getBatchSize(),
    };
  }

  private isEnabled() {
    return (
      process.env.FINANCIAL_RECONCILIATION_SCHEDULER_ENABLED === 'true'
    );
  }

  private getIntervalMs() {
    const parsed = Number(
      process.env.FINANCIAL_RECONCILIATION_INTERVAL_MS ?? '300000',
    );

    return Number.isFinite(parsed) && parsed >= 60000
      ? parsed
      : 300000;
  }

  private getBatchSize() {
    const parsed = Number(
      process.env.FINANCIAL_RECONCILIATION_BATCH_SIZE ?? '100',
    );

    if (!Number.isInteger(parsed) || parsed <= 0) return 100;

    return Math.min(parsed, 500);
  }
}
