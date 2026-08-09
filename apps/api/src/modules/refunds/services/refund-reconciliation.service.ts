import { Injectable } from '@nestjs/common';
import { RefundStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RefundProviderExecutionService } from './refund-provider-execution.service';

export type RefundReconciliationSummary = {
  scanned: number;
  reconciled: number;
  completed: number;
  failed: number;
  stillProcessing: number;
  conflicts: number;
};

@Injectable()
export class RefundReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly execution: RefundProviderExecutionService,
  ) {}

  async reconcileStaleProcessing(limit = 50) {
    const staleMs = this.getStaleMs();
    const before = new Date(Date.now() - staleMs);

    const candidates = await this.prisma.refund.findMany({
      where: {
        status: RefundStatus.PROCESSING,
        updatedAt: { lt: before },
      },
      orderBy: { updatedAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: { id: true },
    });

    const summary: RefundReconciliationSummary = {
      scanned: candidates.length,
      reconciled: 0,
      completed: 0,
      failed: 0,
      stillProcessing: 0,
      conflicts: 0,
    };

    for (const candidate of candidates) {
      try {
        const result = await this.execution.reconcile(candidate.id);
        summary.reconciled += 1;

        if (result.status === RefundStatus.COMPLETED) summary.completed += 1;
        else if (result.status === RefundStatus.FAILED) summary.failed += 1;
        else summary.stillProcessing += 1;
      } catch (error: unknown) {
        const status =
          (error as { status?: number } | null)?.status ??
          (error as { getStatus?: () => number } | null)?.getStatus?.();

        if (status === 409) {
          summary.conflicts += 1;
        } else {
          summary.stillProcessing += 1;
        }
      }
    }

    return summary;
  }

  async inspect(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        payment: true,
      },
    });

    if (!refund) return null;

    const completed = await this.prisma.refund.aggregate({
      where: {
        paymentId: refund.paymentId,
        status: RefundStatus.COMPLETED,
      },
      _sum: { amount: true },
    });

    return {
      refundId: refund.id,
      refundStatus: refund.status,
      paymentId: refund.paymentId,
      paymentStatus: refund.payment.status,
      paymentAmount: refund.payment.amount.toString(),
      completedRefundTotal:
        completed._sum.amount?.toString() ?? '0',
      stale:
        refund.status === RefundStatus.PROCESSING &&
        Date.now() - refund.updatedAt.getTime() >= this.getStaleMs(),
      updatedAt: refund.updatedAt,
    };
  }

  private getStaleMs() {
    const parsed = Number(
      process.env.REFUND_RECONCILIATION_STALE_MS ??
        process.env.REFUND_PROCESSING_STALE_MS ??
        '60000',
    );

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 60_000;
  }
}
