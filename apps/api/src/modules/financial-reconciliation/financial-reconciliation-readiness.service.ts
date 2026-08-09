import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';
import { FinancialReconciliationSchedulerService } from './financial-reconciliation-scheduler.service';

@Injectable()
export class FinancialReconciliationReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: FinancialReconciliationMetricsService,
    private readonly scheduler: FinancialReconciliationSchedulerService,
  ) {}

  async check() {
    const checkedAt = new Date();

    let databaseReady = true;
    let databaseError: string | null = null;

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch (error) {
      databaseReady = false;
      databaseError =
        error instanceof Error ? error.message : String(error);
    }

    const [metrics, scheduler] = await Promise.all([
      this.metrics.getSummary(),
      Promise.resolve(this.scheduler.getStatus()),
    ]);

    const schedulerFresh = this.isSchedulerFresh(
      scheduler.enabled,
      scheduler.lastSuccessAt,
      scheduler.intervalMs,
    );

    const maxCritical = this.getCriticalIncidentThreshold();
    const criticalWithinThreshold =
      metrics.critical <= maxCritical;

    const ready =
      databaseReady &&
      schedulerFresh &&
      criticalWithinThreshold &&
      scheduler.consecutiveFailures <
        this.getSchedulerFailureThreshold();

    return {
      ready,
      checkedAt,
      checks: {
        database: {
          ready: databaseReady,
          error: databaseError,
        },
        scheduler: {
          ready:
            schedulerFresh &&
            scheduler.consecutiveFailures <
              this.getSchedulerFailureThreshold(),
          status: scheduler,
        },
        incidents: {
          ready: criticalWithinThreshold,
          critical: metrics.critical,
          maxCritical,
          summary: metrics,
        },
      },
    };
  }

  async monitoring() {
    const [metrics, readiness] = await Promise.all([
      this.metrics.getSummary(),
      this.check(),
    ]);

    return {
      generatedAt: new Date(),
      metrics,
      scheduler: this.scheduler.getStatus(),
      readiness,
    };
  }

  private isSchedulerFresh(
    enabled: boolean,
    lastSuccessAt: Date | null,
    intervalMs: number,
  ) {
    if (!enabled) return true;

    // Um worker recém-iniciado ainda é considerado pronto por até 2 intervalos.
    if (!lastSuccessAt) return true;

    const staleAfterMs = Math.max(
      intervalMs * 2,
      Number(
        process.env.FINANCIAL_RECONCILIATION_STALE_AFTER_MS ??
          intervalMs * 2,
      ),
    );

    return (
      Date.now() - new Date(lastSuccessAt).getTime() <=
      staleAfterMs
    );
  }

  private getCriticalIncidentThreshold() {
    const parsed = Number(
      process.env
        .FINANCIAL_RECONCILIATION_MAX_CRITICAL_INCIDENTS ?? '100',
    );

    return Number.isInteger(parsed) && parsed >= 0
      ? parsed
      : 100;
  }

  private getSchedulerFailureThreshold() {
    const parsed = Number(
      process.env
        .FINANCIAL_RECONCILIATION_MAX_CONSECUTIVE_FAILURES ?? '3',
    );

    return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
  }
}
