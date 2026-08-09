import { Injectable } from '@nestjs/common';
import { RefundStatus, WebhookStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RefundMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot() {
    const now = Date.now();
    const slaMs = this.getSlaMs();
    const staleBefore = new Date(now - slaMs);

    const [
      pending,
      processing,
      completed,
      failed,
      staleProcessing,
      failedWebhooks,
      recentCompleted,
    ] = await Promise.all([
      this.prisma.refund.count({ where: { status: RefundStatus.PENDING } }),
      this.prisma.refund.count({ where: { status: RefundStatus.PROCESSING } }),
      this.prisma.refund.count({ where: { status: RefundStatus.COMPLETED } }),
      this.prisma.refund.count({ where: { status: RefundStatus.FAILED } }),
      this.prisma.refund.count({
        where: {
          status: RefundStatus.PROCESSING,
          updatedAt: { lt: staleBefore },
        },
      }),
      this.prisma.webhookEvent.count({
        where: {
          status: WebhookStatus.FAILED,
          eventType: { startsWith: 'refund.' },
        },
      }),
      this.prisma.refund.findMany({
        where: {
          status: RefundStatus.COMPLETED,
          processedAt: { not: null },
        },
        orderBy: { processedAt: 'desc' },
        take: 500,
        select: {
          createdAt: true,
          processedAt: true,
        },
      }),
    ]);

    const durations = recentCompleted
      .filter((item) => item.processedAt)
      .map((item) =>
        Math.max(
          0,
          item.processedAt!.getTime() - item.createdAt.getTime(),
        ),
      );

    const averageProcessingMs =
      durations.length === 0
        ? 0
        : Math.round(
            durations.reduce((sum, value) => sum + value, 0) /
              durations.length,
          );

    const p95ProcessingMs = this.percentile(durations, 0.95);

    return {
      counts: {
        pending,
        processing,
        completed,
        failed,
        staleProcessing,
        failedWebhooks,
      },
      latency: {
        sampleSize: durations.length,
        averageProcessingMs,
        p95ProcessingMs,
        slaMs,
      },
      generatedAt: new Date(),
    };
  }

  private percentile(values: number[], percentile: number) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(percentile * sorted.length) - 1),
    );
    return sorted[index];
  }

  private getSlaMs() {
    const parsed = Number(process.env.REFUND_PROCESSING_SLA_MS ?? '300000');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 300_000;
  }
}
