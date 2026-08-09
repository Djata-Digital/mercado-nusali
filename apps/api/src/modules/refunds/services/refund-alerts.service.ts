import { Injectable } from '@nestjs/common';

import { RefundMetricsService } from './refund-metrics.service';

export type RefundAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type RefundOperationalAlert = {
  code: string;
  severity: RefundAlertSeverity;
  message: string;
  value: number;
  threshold: number;
};

@Injectable()
export class RefundAlertsService {
  constructor(private readonly metrics: RefundMetricsService) {}

  async evaluate() {
    const snapshot = await this.metrics.snapshot();
    const alerts: RefundOperationalAlert[] = [];

    const staleWarning = this.envInt('REFUND_ALERT_STALE_WARNING', 1);
    const staleCritical = this.envInt('REFUND_ALERT_STALE_CRITICAL', 5);
    const failedWarning = this.envInt('REFUND_ALERT_FAILED_WARNING', 1);
    const failedCritical = this.envInt('REFUND_ALERT_FAILED_CRITICAL', 5);
    const webhookWarning = this.envInt(
      'REFUND_ALERT_WEBHOOK_FAILED_WARNING',
      1,
    );
    const webhookCritical = this.envInt(
      'REFUND_ALERT_WEBHOOK_FAILED_CRITICAL',
      5,
    );

    this.pushThresholdAlert(
      alerts,
      'REFUND_STALE_PROCESSING',
      'Refunds PROCESSING acima do SLA',
      snapshot.counts.staleProcessing,
      staleWarning,
      staleCritical,
    );

    this.pushThresholdAlert(
      alerts,
      'REFUND_FAILED',
      'Refunds em estado FAILED',
      snapshot.counts.failed,
      failedWarning,
      failedCritical,
    );

    this.pushThresholdAlert(
      alerts,
      'REFUND_WEBHOOK_FAILED',
      'Webhooks de refund com falha',
      snapshot.counts.failedWebhooks,
      webhookWarning,
      webhookCritical,
    );

    return {
      healthy: !alerts.some((item) => item.severity === 'CRITICAL'),
      alerts,
      metrics: snapshot,
    };
  }

  private pushThresholdAlert(
    alerts: RefundOperationalAlert[],
    code: string,
    message: string,
    value: number,
    warning: number,
    critical: number,
  ) {
    if (value >= critical) {
      alerts.push({
        code,
        severity: 'CRITICAL',
        message,
        value,
        threshold: critical,
      });
      return;
    }

    if (value >= warning) {
      alerts.push({
        code,
        severity: 'WARNING',
        message,
        value,
        threshold: warning,
      });
    }
  }

  private envInt(name: string, fallback: number) {
    const parsed = Number(process.env[name]);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }
}
