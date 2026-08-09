import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type RefundAuditAction =
  | 'REFUND_ADMIN_RECONCILE'
  | 'REFUND_ADMIN_RECONCILE_STALE'
  | 'REFUND_ADMIN_REPORT_EXPORT';

@Injectable()
export class RefundAuditReportService {
  constructor(private readonly prisma: PrismaService) {}

  async logAdminAction(input: {
    userId?: string | null;
    action: RefundAuditAction;
    refundId?: string | null;
    previousValue?: unknown;
    newValue?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.refundId ? 'Refund' : 'RefundOperations',
        entityId: input.refundId ?? null,
        previousValue: input.previousValue == null ? undefined : JSON.parse(JSON.stringify(input.previousValue)),
        newValue: input.newValue == null ? undefined : JSON.parse(JSON.stringify(input.newValue)),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
      },
    });
  }

  async history(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      select: { id: true, paymentId: true, orderId: true, status: true, createdAt: true, updatedAt: true, processedAt: true },
    });
    if (!refund) throw new NotFoundException('Refund não encontrado.');

    const [audits, webhooks, outbox] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entity: 'Refund', entityId: refundId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, userId: true, action: true, previousValue: true, newValue: true, requestId: true, createdAt: true },
      }),
      this.prisma.webhookEvent.findMany({
        where: { eventType: { startsWith: 'refund.' }, payloadJson: { path: ['refundId'], equals: refundId } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, provider: true, eventId: true, eventType: true, status: true, processedAt: true, createdAt: true },
      }),
      this.prisma.outboxEvent.findMany({
        where: { aggregateType: 'Refund', aggregateId: refundId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, eventType: true, status: true, publishedAt: true, createdAt: true },
      }),
    ]);

    const timeline = [
      ...audits.map((x) => ({ source: 'AUDIT', at: x.createdAt, data: x })),
      ...webhooks.map((x) => ({ source: 'WEBHOOK', at: x.createdAt, data: x })),
      ...outbox.map((x) => ({ source: 'OUTBOX', at: x.createdAt, data: x })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    return { refund, timeline };
  }

  async report(input?: { from?: Date; to?: Date; limit?: number }) {
    const limit = Math.min(Math.max(Number(input?.limit) || 200, 1), 1000);
    const createdAt = input?.from || input?.to ? { gte: input?.from, lte: input?.to } : undefined;
    const refunds = await this.prisma.refund.findMany({
      where: createdAt ? { createdAt } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, paymentId: true, orderId: true, buyerId: true, amount: true,
        status: true, reason: true, processedAt: true, createdAt: true, updatedAt: true,
        currency: { select: { code: true } },
        payment: { select: { provider: true } },
      },
    });

    const rows = refunds.map((r) => ({
      refundId: r.id, paymentId: r.paymentId, orderId: r.orderId, buyerId: r.buyerId,
      amount: r.amount.toString(), currency: r.currency.code, status: r.status, reason: r.reason,
      provider: r.payment.provider, createdAt: r.createdAt, updatedAt: r.updatedAt, processedAt: r.processedAt,
    }));
    return { generatedAt: new Date(), filters: { from: input?.from ?? null, to: input?.to ?? null }, count: rows.length, rows };
  }
}
