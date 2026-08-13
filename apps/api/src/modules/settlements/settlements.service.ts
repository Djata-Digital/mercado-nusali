import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FinancialReconciliationIncidentStatus,
  Prisma,
  SettlementAdjustmentType,
  SettlementBatchStatus,
  SellerSettlementStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBatch(input: { periodStart: Date; periodEnd: Date; currencyId: string }) {
    if (input.periodEnd <= input.periodStart) {
      throw new BadRequestException('periodEnd deve ser posterior a periodStart.');
    }
    return this.prisma.settlementBatch.upsert({
      where: { periodStart_periodEnd_currencyId: input },
      create: input,
      update: {},
    });
  }

  async listBatches(limit = 100) {
    const take = Math.min(
      Math.max(
        Number(limit) || 100,
        1,
      ),
      200,
    );

    return this.prisma.settlementBatch.findMany({
      take,

      orderBy: {
        createdAt: 'desc',
      },

      include: {
        _count: {
          select: {
            settlements: true,
          },
        },
      },
    });
  }

  async getBatch(id: string) {
    const batch = await this.prisma.settlementBatch.findUnique({
      where: { id },
      include: { settlements: { orderBy: { sellerId: 'asc' }, include: { adjustmentEntries: true } } },
    });
    if (!batch) throw new NotFoundException('SettlementBatch não encontrado.');
    return batch;
  }

  async closeBatch(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.settlementBatch.findUnique({ where: { id } });
      if (!batch) throw new NotFoundException('SettlementBatch não encontrado.');
      if (batch.status === SettlementBatchStatus.CLOSED) {
        return tx.settlementBatch.findUnique({ where: { id }, include: { settlements: true } });
      }
      if (batch.status !== SettlementBatchStatus.OPEN) {
        throw new BadRequestException('Somente batches OPEN podem ser fechados.');
      }
      const claimed = await tx.settlementBatch.updateMany({
        where: { id, status: SettlementBatchStatus.OPEN },
        data: { status: SettlementBatchStatus.PROCESSING },
      });
      if (claimed.count !== 1) throw new BadRequestException('O SettlementBatch foi alterado por outra operação.');

      const rows = await tx.$queryRaw<Array<{ sellerId: string; grossAmount: Prisma.Decimal; platformFee: Prisma.Decimal }>>(Prisma.sql`
        SELECT
          e."sellerId" AS "sellerId",
          COALESCE(SUM(e."releasedAmount"), 0) AS "grossAmount",
          COALESCE(SUM(
            CASE WHEN e."totalAmount" > 0
              THEN ROUND(e."commissionAmount" * e."releasedAmount" / e."totalAmount", 4)
              ELSE 0 END
          ), 0) AS "platformFee"
        FROM "escrow_accounts" e
        WHERE e."releasedAmount" > 0
          AND e."currencyId" = ${batch.currencyId}
          AND e."updatedAt" >= ${batch.periodStart}
          AND e."updatedAt" < ${batch.periodEnd}
        GROUP BY e."sellerId"
      `);

      for (const row of rows) {
        const gross = new Prisma.Decimal(row.grossAmount);
        const fee = new Prisma.Decimal(row.platformFee);
        const adjustments = new Prisma.Decimal(0);
        const payout = gross.minus(fee);
        await tx.sellerSettlement.upsert({
          where: { batchId_sellerId: { batchId: id, sellerId: row.sellerId } },
          create: {
            batchId: id, sellerId: row.sellerId, currencyId: batch.currencyId,
            grossAmount: gross, platformFee: fee, adjustments, payoutAmount: payout,
            status: payout.gt(0) ? SellerSettlementStatus.READY : SellerSettlementStatus.PENDING,
            statementJson: {
              grossAmount: gross.toFixed(4), platformFee: fee.toFixed(4),
              adjustments: adjustments.toFixed(4), payoutAmount: payout.toFixed(4),
              feeSource: 'ESCROW_COMMISSION_ALLOCATED',
            },
          },
          update: {},
        });
      }
      await tx.settlementBatch.update({ where: { id }, data: { status: SettlementBatchStatus.CLOSED, closedAt: new Date() } });
      return tx.settlementBatch.findUnique({ where: { id }, include: { settlements: { orderBy: { sellerId: 'asc' } } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async addAdjustment(input: { batchId: string; sellerId: string; amount: string; type: 'CREDIT' | 'DEBIT'; reason: string; createdBy?: string | null }) {
    let amount: Prisma.Decimal;
    try { amount = new Prisma.Decimal(input.amount); } catch { throw new BadRequestException('amount inválido.'); }
    if (!amount.isFinite() || amount.lte(0)) throw new BadRequestException('amount deve ser maior que zero.');
    if (amount.decimalPlaces() > 4) throw new BadRequestException('amount aceita no máximo 4 casas decimais.');
    const type = input.type === 'CREDIT' ? SettlementAdjustmentType.CREDIT : SettlementAdjustmentType.DEBIT;

    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.sellerSettlement.findUnique({ where: { batchId_sellerId: { batchId: input.batchId, sellerId: input.sellerId } } });
      if (!settlement) throw new NotFoundException('Settlement do vendedor não encontrado.');
      if (settlement.status === SellerSettlementStatus.SETTLED) throw new BadRequestException('Settlement já liquidado não aceita ajustes.');
      const signed = type === SettlementAdjustmentType.CREDIT ? amount : amount.negated();
      const newAdjustments = settlement.adjustments.add(signed);
      const payoutAmount = settlement.grossAmount.minus(settlement.platformFee).plus(newAdjustments);
      if (payoutAmount.lt(0)) throw new BadRequestException('O ajuste deixaria o payoutAmount negativo.');

      const entry = await tx.settlementAdjustment.create({
        data: { settlementId: settlement.id, type, amount, reason: input.reason.trim(), createdBy: input.createdBy ?? null },
      });
      await tx.sellerSettlement.update({
        where: { id: settlement.id },
        data: {
          adjustments: newAdjustments,
          payoutAmount,
          status: payoutAmount.gt(0) ? SellerSettlementStatus.READY : SellerSettlementStatus.PENDING,
          statementJson: {
            grossAmount: settlement.grossAmount.toFixed(4),
            platformFee: settlement.platformFee.toFixed(4),
            adjustments: newAdjustments.toFixed(4), payoutAmount: payoutAmount.toFixed(4),
            feeSource: 'ESCROW_COMMISSION_ALLOCATED',
          },
        },
      });
      return { id: entry.id, type: entry.type, amount: entry.amount.toString(), reason: entry.reason, payoutAmount: payoutAmount.toString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async payoutEligibility(batchId: string, sellerId: string) {
    const settlement = await this.prisma.sellerSettlement.findUnique({
      where: { batchId_sellerId: { batchId, sellerId } },
      include: { batch: true },
    });
    if (!settlement) throw new NotFoundException('Settlement do vendedor não encontrado.');

    const orderGroups = await this.prisma.escrowAccount.findMany({
      where: {
        sellerId,
        currencyId: settlement.currencyId,
        updatedAt: { gte: settlement.batch.periodStart, lt: settlement.batch.periodEnd },
        releasedAmount: { gt: 0 },
      },
      select: { orderGroupId: true },
      distinct: ['orderGroupId'],
    });
    const ids = orderGroups.map((x) => x.orderGroupId);
    const blockingIncidents = ids.length ? await this.prisma.financialReconciliationIncident.count({
      where: { orderGroupId: { in: ids }, status: { in: [FinancialReconciliationIncidentStatus.OPEN, FinancialReconciliationIncidentStatus.ACKNOWLEDGED] } },
    }) : 0;

    const reasons: string[] = [];
    if (settlement.batch.status !== SettlementBatchStatus.CLOSED) reasons.push('BATCH_NOT_CLOSED');
    if (settlement.status !== SellerSettlementStatus.READY) reasons.push('SETTLEMENT_NOT_READY');
    if (settlement.payoutAmount.lte(0)) reasons.push('NON_POSITIVE_PAYOUT');
    if (blockingIncidents > 0) reasons.push('OPEN_FINANCIAL_RECONCILIATION_INCIDENTS');
    return { eligible: reasons.length === 0, reasons, blockingIncidents, payoutAmount: settlement.payoutAmount.toString(), currencyId: settlement.currencyId };
  }

  async sellerStatement(batchId: string, sellerId: string) {
    const settlement = await this.prisma.sellerSettlement.findUnique({
      where: { batchId_sellerId: { batchId, sellerId } },
      include: { adjustmentEntries: { orderBy: { createdAt: 'asc' } } },
    });
    if (!settlement) throw new NotFoundException('Demonstrativo do vendedor não encontrado.');
    return {
      id: settlement.id, batchId: settlement.batchId, sellerId: settlement.sellerId, currencyId: settlement.currencyId,
      grossAmount: settlement.grossAmount.toString(), platformFee: settlement.platformFee.toString(),
      adjustments: settlement.adjustments.toString(), payoutAmount: settlement.payoutAmount.toString(), status: settlement.status,
      statement: settlement.statementJson,
      adjustmentEntries: settlement.adjustmentEntries.map((x) => ({ id: x.id, type: x.type, amount: x.amount.toString(), reason: x.reason, createdBy: x.createdBy, createdAt: x.createdAt })),
      payoutId: settlement.payoutId,
      payoutRequestedAt: settlement.payoutRequestedAt,
      createdAt: settlement.createdAt, settledAt: settlement.settledAt,
    };
  }
}
