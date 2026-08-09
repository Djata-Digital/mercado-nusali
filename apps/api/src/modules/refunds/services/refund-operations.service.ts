import { Injectable, NotFoundException } from '@nestjs/common';
import { RefundStatus, WebhookStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RefundProviderExecutionService } from './refund-provider-execution.service';
import { RefundReconciliationService } from './refund-reconciliation.service';

@Injectable()
export class RefundOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: RefundReconciliationService,
    private readonly execution: RefundProviderExecutionService,
  ) {}

  async summary() {
    const staleBefore = new Date(Date.now() - this.getStaleMs());

    const [pending, processing, completed, failed, staleProcessing, failedWebhooks] =
      await Promise.all([
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
      ]);

    return {
      refunds: { pending, processing, completed, failed, staleProcessing },
      webhooks: { failed: failedWebhooks },
      generatedAt: new Date(),
    };
  }

  async listIssues(limit = 50) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const staleBefore = new Date(Date.now() - this.getStaleMs());

    const [refunds, webhooks] = await Promise.all([
      this.prisma.refund.findMany({
        where: {
          OR: [
            { status: RefundStatus.FAILED },
            {
              status: RefundStatus.PROCESSING,
              updatedAt: { lt: staleBefore },
            },
          ],
        },
        orderBy: { updatedAt: 'asc' },
        take,
        select: {
          id: true,
          paymentId: true,
          orderId: true,
          amount: true,
          status: true,
          reason: true,
          processedAt: true,
          createdAt: true,
          updatedAt: true,
          payment: {
            select: {
              provider: true,
              providerReference: true,
              providerTransactionId: true,
            },
          },
        },
      }),
      this.prisma.webhookEvent.findMany({
        where: {
          status: WebhookStatus.FAILED,
          eventType: { startsWith: 'refund.' },
        },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          provider: true,
          eventId: true,
          eventType: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      refunds: refunds.map((item) => ({
        id: item.id,
        paymentId: item.paymentId,
        orderId: item.orderId,
        amount: item.amount.toString(),
        status: item.status,
        reason: item.reason,
        processedAt: item.processedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        provider: item.payment.provider,
        providerReference: item.payment.providerReference,
        providerTransactionId: item.payment.providerTransactionId,
        stale:
          item.status === RefundStatus.PROCESSING &&
          item.updatedAt.getTime() < staleBefore.getTime(),
      })),
      failedWebhooks: webhooks,
    };
  }

  async inspect(refundId: string) {
    const reconciliation = await this.reconciliation.inspect(refundId);
    if (!reconciliation) {
      throw new NotFoundException('Refund não encontrado.');
    }

    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        reason: true,
        processedAt: true,
        createdAt: true,
        updatedAt: true,
        payment: {
          select: {
            provider: true,
            providerReference: true,
            providerTransactionId: true,
          },
        },
      },
    });

    const recentWebhooks = await this.prisma.webhookEvent.findMany({
      where: {
        eventType: { startsWith: 'refund.' },
        payloadJson: {
          path: ['refundId'],
          equals: refundId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        provider: true,
        eventId: true,
        eventType: true,
        status: true,
        createdAt: true,
        processedAt: true,
      },
    });

    return {
      ...reconciliation,
      provider: refund?.payment.provider ?? null,
      providerReference: refund?.payment.providerReference ?? null,
      providerTransactionId:
        refund?.payment.providerTransactionId ?? null,
      reason: refund?.reason ?? null,
      processedAt: refund?.processedAt ?? null,
      recentWebhooks,
    };
  }

  async reconcileOne(refundId: string) {
    const existing = await this.prisma.refund.findUnique({
      where: { id: refundId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Refund não encontrado.');

    return this.execution.reconcile(refundId);
  }

  async reconcileStale(limit = 50) {
    return this.reconciliation.reconcileStaleProcessing(limit);
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
