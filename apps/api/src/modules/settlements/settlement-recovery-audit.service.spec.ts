import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PayoutStatus,
  Prisma,
  SellerSettlementStatus,
} from '@prisma/client';

import { SettlementRecoveryAuditService } from './settlement-recovery-audit.service';

describe('SettlementRecoveryAuditService - Sprint 7.6.6', () => {
  function settlement(overrides: Record<string, unknown> = {}) {
    return {
      id: 'settlement-1',
      batchId: 'batch-1',
      sellerId: 'seller-1',
      currencyId: 'BRL',
      grossAmount: new Prisma.Decimal('100'),
      platformFee: new Prisma.Decimal('10'),
      adjustments: new Prisma.Decimal('0'),
      payoutAmount: new Prisma.Decimal('90'),
      status: SellerSettlementStatus.PAYOUT_PENDING,
      payoutId: 'payout-1',
      payoutRequestedAt: new Date('2026-08-08T10:00:00Z'),
      settledAt: null,
      statementJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function build() {
    const prisma: any = {
      sellerSettlement: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      settlementBatch: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(),
    };

    const payouts: any = {
      reconcilePayout: jest.fn(),
    };

    const batchOperations: any = {
      reconcileBatch: jest.fn(),
    };

    return {
      prisma,
      payouts,
      batchOperations,
      service: new SettlementRecoveryAuditService(
        prisma,
        payouts,
        batchOperations,
      ),
    };
  }

  it('audita reconciliação de settlement com before/after', async () => {
    const { service, prisma, payouts } = build();

    prisma.sellerSettlement.findUnique
      .mockResolvedValueOnce(settlement())
      .mockResolvedValueOnce(
        settlement({
          status: SellerSettlementStatus.SETTLED,
          settledAt: new Date(),
        }),
      );

    payouts.reconcilePayout.mockResolvedValue({
      consistent: true,
      action: 'MARKED_SETTLED',
    });

    const result =
      await service.reconcileSettlementWithAudit(
        'settlement-1',
        {
          actorId: 'admin-1',
          requestId: 'req-1',
        },
        'reconciliação manual',
      );

    expect(result.action).toBe('MARKED_SETTLED');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin-1',
          action: 'SETTLEMENT_PAYOUT_RECONCILE',
          entity: 'SellerSettlement',
          entityId: 'settlement-1',
          requestId: 'req-1',
        }),
      }),
    );
  });

  it('audita falha de reconciliação antes de propagar erro', async () => {
    const { service, prisma, payouts } = build();

    prisma.sellerSettlement.findUnique.mockResolvedValue(
      settlement(),
    );
    payouts.reconcilePayout.mockRejectedValue(
      new Error('provider unavailable'),
    );

    await expect(
      service.reconcileSettlementWithAudit(
        'settlement-1',
        { actorId: 'admin-1' },
      ),
    ).rejects.toThrow('provider unavailable');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SETTLEMENT_PAYOUT_RECONCILE_FAILED',
        }),
      }),
    );
  });

  it('audita reconciliação de batch', async () => {
    const { service, prisma, batchOperations } = build();

    prisma.settlementBatch.findUnique.mockResolvedValue({
      id: 'batch-1',
      status: 'CLOSED',
      closedAt: new Date(),
    });

    batchOperations.reconcileBatch.mockResolvedValue({
      batchId: 'batch-1',
      scanned: 3,
      reconciled: 2,
      failures: 0,
      results: [],
    });

    const result = await service.reconcileBatchWithAudit(
      'batch-1',
      { actorId: 'system' },
    );

    expect(result.reconciled).toBe(2);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: null,
          action: 'SETTLEMENT_BATCH_RECONCILE',
          entity: 'SettlementBatch',
        }),
      }),
    );
  });

  it('prepareRetry só reabre FAILED com payout FAILED/CANCELLED', async () => {
    const { service, prisma } = build();

    const before = settlement({
      status: SellerSettlementStatus.FAILED,
      payout: {
        id: 'payout-1',
        status: PayoutStatus.FAILED,
      },
    });

    const after = settlement({
      status: SellerSettlementStatus.READY,
      payoutId: null,
      payoutRequestedAt: null,
    });

    prisma.sellerSettlement.findUnique.mockResolvedValue(before);
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        sellerSettlement: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(after),
        },
      }),
    );

    const result = await service.prepareRetry(
      'settlement-1',
      { actorId: 'admin-1' },
      'provider confirmou falha',
    );

    expect(result.idempotent).toBe(false);
    expect(result.previousPayoutId).toBe('payout-1');
    expect(result.settlement.status).toBe(
      SellerSettlementStatus.READY,
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SETTLEMENT_PREPARE_RETRY',
        }),
      }),
    );
  });

  it('prepareRetry rejeita payout PAID', async () => {
    const { service, prisma } = build();

    prisma.sellerSettlement.findUnique.mockResolvedValue(
      settlement({
        status: SellerSettlementStatus.FAILED,
        payout: {
          id: 'payout-1',
          status: PayoutStatus.PAID,
        },
      }),
    );

    await expect(
      service.prepareRetry(
        'settlement-1',
        { actorId: 'admin-1' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prepareRetry é idempotente quando já voltou para READY sem payout', async () => {
    const { service, prisma } = build();

    prisma.sellerSettlement.findUnique.mockResolvedValue(
      settlement({
        status: SellerSettlementStatus.READY,
        payoutId: null,
        payoutRequestedAt: null,
        payout: null,
      }),
    );

    const result = await service.prepareRetry(
      'settlement-1',
      { actorId: 'admin-1' },
    );

    expect(result.idempotent).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('histórico limita consulta a 500 e valida existência', async () => {
    const { service, prisma } = build();

    prisma.sellerSettlement.findUnique.mockResolvedValue({
      id: 'settlement-1',
    });

    await service.settlementHistory(
      'settlement-1',
      9999,
    );

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 500,
        where: expect.objectContaining({
          entity: 'SellerSettlement',
          entityId: 'settlement-1',
        }),
      }),
    );

    prisma.sellerSettlement.findUnique.mockResolvedValue(null);

    await expect(
      service.settlementHistory('missing', 10),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
