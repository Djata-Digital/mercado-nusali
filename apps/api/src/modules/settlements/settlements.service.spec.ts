import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SettlementsService } from './settlements.service';

describe('SettlementsService - Sprint 7.6.2', () => {
  it('rejeita período inválido', async () => {
    const service = new SettlementsService({} as any);
    await expect(service.createBatch({ periodStart: new Date('2026-08-08T10:00:00Z'), periodEnd: new Date('2026-08-08T09:00:00Z'), currencyId: 'BRL' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aplica CREDIT e recalcula payout sem Number para dinheiro', async () => {
    const tx: any = {
      sellerSettlement: {
        findUnique: jest.fn().mockResolvedValue({ id: 's1', grossAmount: new Prisma.Decimal('100'), platformFee: new Prisma.Decimal('10'), adjustments: new Prisma.Decimal('0'), payoutAmount: new Prisma.Decimal('90'), status: 'READY' }),
        update: jest.fn().mockResolvedValue({}),
      },
      settlementAdjustment: { create: jest.fn().mockResolvedValue({ id: 'a1', type: 'CREDIT', amount: new Prisma.Decimal('2.50'), reason: 'correção' }) },
    };
    const prisma: any = { $transaction: (fn: any) => fn(tx) };
    const result = await new SettlementsService(prisma).addAdjustment({ batchId: 'b1', sellerId: 'seller1', amount: '2.50', type: 'CREDIT', reason: 'correção' });
    expect(result.payoutAmount).toBe('92.5');
  });

  it('impede ajuste que deixa payout negativo', async () => {
    const tx: any = { sellerSettlement: { findUnique: jest.fn().mockResolvedValue({ id: 's1', grossAmount: new Prisma.Decimal('10'), platformFee: new Prisma.Decimal('1'), adjustments: new Prisma.Decimal('0'), status: 'READY' }) } };
    const prisma: any = { $transaction: (fn: any) => fn(tx) };
    await expect(new SettlementsService(prisma).addAdjustment({ batchId: 'b1', sellerId: 's1', amount: '20', type: 'DEBIT', reason: 'chargeback' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloqueia elegibilidade quando há incidente financeiro aberto', async () => {
    const prisma: any = {
      sellerSettlement: { findUnique: jest.fn().mockResolvedValue({ currencyId: 'BRL', payoutAmount: new Prisma.Decimal('90'), status: 'READY', batch: { status: 'CLOSED', periodStart: new Date(), periodEnd: new Date() } }) },
      escrowAccount: { findMany: jest.fn().mockResolvedValue([{ orderGroupId: 'og1' }]) },
      financialReconciliationIncident: { count: jest.fn().mockResolvedValue(1) },
    };
    const result = await new SettlementsService(prisma).payoutEligibility('b1', 's1');
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('OPEN_FINANCIAL_RECONCILIATION_INCIDENTS');
  });

  it('serializa dinheiro e ajustes do statement como string', async () => {
    const prisma: any = { sellerSettlement: { findUnique: jest.fn().mockResolvedValue({ id:'s1',batchId:'b1',sellerId:'seller1',currencyId:'BRL',grossAmount:new Prisma.Decimal('100.50'),platformFee:new Prisma.Decimal('10.05'),adjustments:new Prisma.Decimal('2.5'),payoutAmount:new Prisma.Decimal('92.95'),status:'READY',statementJson:{},adjustmentEntries:[{id:'a1',type:'CREDIT',amount:new Prisma.Decimal('2.5'),reason:'x',createdBy:null,createdAt:new Date()}],createdAt:new Date(),settledAt:null }) } };
    const result = await new SettlementsService(prisma).sellerStatement('b1','seller1');
    expect(result.payoutAmount).toBe('92.95');
    expect(result.adjustmentEntries[0].amount).toBe('2.5');
  });

  it('rejeita statement inexistente', async () => {
    const prisma: any = { sellerSettlement: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(new SettlementsService(prisma).sellerStatement('b1','404')).rejects.toBeInstanceOf(NotFoundException);
  });
});
