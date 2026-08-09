import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  PayoutStatus,
  Prisma,
  SellerSettlementStatus,
} from '@prisma/client';

import { SettlementPayoutService } from './settlement-payout.service';

describe('SettlementPayoutService - Sprint 7.6.4 idempotency fix', () => {
  function build() {
    const prisma: any = {
      sellerSettlement: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      sellerProfile: { findUnique: jest.fn() },
      payout: { findUnique: jest.fn() },
    };

    const settlements: any = {
      payoutEligibility: jest.fn(),
    };

    const payouts: any = {
      requestPayout: jest.fn(),
      processPayout: jest.fn(),
      cancelPayout: jest.fn(),
    };

    return {
      prisma,
      settlements,
      payouts,
      service: new SettlementPayoutService(
        prisma,
        settlements,
        payouts,
      ),
    };
  }

  it('bloqueia criação quando settlement READY não é elegível', async () => {
    const { service, prisma, settlements } = build();

    prisma.sellerSettlement.findUnique.mockResolvedValue({
      id: 'settlement-1',
      payoutId: null,
      status: SellerSettlementStatus.READY,
    });
    settlements.payoutEligibility.mockResolvedValue({
      eligible: false,
      reasons: ['OPEN_FINANCIAL_RECONCILIATION_INCIDENTS'],
      payoutAmount: '90',
      currencyId: 'BRL',
    });

    await expect(
      service.requestPayout('b1', 's1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('faz claim READY -> PAYOUT_PENDING e cria payout uma única vez', async () => {
    const { service, prisma, settlements, payouts } =
      build();

    prisma.sellerSettlement.findUnique.mockResolvedValueOnce({
      id: 'settlement-1',
      payoutId: null,
      status: SellerSettlementStatus.READY,
    });
    settlements.payoutEligibility.mockResolvedValue({
      eligible: true,
      reasons: [],
      payoutAmount: '90.50',
      currencyId: 'BRL',
    });
    prisma.sellerSettlement.updateMany.mockResolvedValue({
      count: 1,
    });
    prisma.sellerProfile.findUnique.mockResolvedValue({
      id: 'seller-1',
      userId: 'user-1',
    });
    payouts.requestPayout.mockResolvedValue({
      id: 'payout-1',
      amount: new Prisma.Decimal('90.50'),
      status: PayoutStatus.CREATED,
    });
    prisma.sellerSettlement.update.mockResolvedValue({
      id: 'settlement-1',
      payoutId: 'payout-1',
      status: SellerSettlementStatus.PAYOUT_PENDING,
    });

    const result = await service.requestPayout(
      'b1',
      'seller-1',
    );

    expect(result.idempotent).toBe(false);
    expect(payouts.requestPayout).toHaveBeenCalledTimes(1);
  });

  it('segunda chamada com payoutId retorna idempotente antes da elegibilidade', async () => {
    const { service, prisma, settlements, payouts } =
      build();

    prisma.sellerSettlement.findUnique.mockResolvedValue({
      id: 'settlement-1',
      payoutId: 'payout-1',
      status: SellerSettlementStatus.PAYOUT_PENDING,
    });
    prisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      status: PayoutStatus.CREATED,
    });

    const result = await service.requestPayout(
      'b1',
      'seller-1',
    );

    expect(result.idempotent).toBe(true);
    expect(settlements.payoutEligibility).not.toHaveBeenCalled();
    expect(payouts.requestPayout).not.toHaveBeenCalled();
  });

  it('PAYOUT_PENDING sem payoutId continua sendo conflito de worker', async () => {
    const { service, prisma, settlements } = build();

    prisma.sellerSettlement.findUnique.mockResolvedValue({
      id: 'settlement-1',
      payoutId: null,
      status: SellerSettlementStatus.PAYOUT_PENDING,
    });

    await expect(
      service.requestPayout('b1', 'seller-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(settlements.payoutEligibility).not.toHaveBeenCalled();
  });

  it('falha ao criar payout devolve settlement para READY', async () => {
    const { service, prisma, settlements, payouts } =
      build();

    prisma.sellerSettlement.findUnique.mockResolvedValueOnce({
      id: 'settlement-1',
      payoutId: null,
      status: SellerSettlementStatus.READY,
    });
    settlements.payoutEligibility.mockResolvedValue({
      eligible: true,
      reasons: [],
      payoutAmount: '90',
      currencyId: 'BRL',
    });
    prisma.sellerSettlement.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.sellerProfile.findUnique.mockResolvedValue({
      id: 'seller-1',
      userId: 'user-1',
    });
    payouts.requestPayout.mockRejectedValue(
      new Error('wallet failure'),
    );

    await expect(
      service.requestPayout('b1', 'seller-1'),
    ).rejects.toThrow('wallet failure');

    expect(
      prisma.sellerSettlement.updateMany,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SellerSettlementStatus.READY,
          payoutRequestedAt: null,
        }),
      }),
    );
  });

  it('processa payout PAID e marca settlement como SETTLED', async () => {
    const { service, prisma, payouts } = build();

    prisma.sellerSettlement.findUnique.mockResolvedValue({
      id: 'settlement-1',
      payoutId: 'payout-1',
      status: SellerSettlementStatus.PAYOUT_PENDING,
    });
    payouts.processPayout.mockResolvedValue({
      id: 'payout-1',
      status: PayoutStatus.PAID,
    });
    prisma.sellerSettlement.updateMany.mockResolvedValue({
      count: 1,
    });
    prisma.sellerSettlement.findUniqueOrThrow.mockResolvedValue({
      id: 'settlement-1',
      payoutId: 'payout-1',
      status: SellerSettlementStatus.SETTLED,
    });

    const result = await service.processPayout(
      'settlement-1',
    );

    expect(result.idempotent).toBe(false);
    expect(result.settlement.status).toBe(
      SellerSettlementStatus.SETTLED,
    );
  });

  it('reconciliação converte payout FAILED em settlement FAILED', async () => {
    const { service, prisma } = build();

    prisma.sellerSettlement.findUnique.mockResolvedValue({
      id: 'settlement-1',
      payoutId: 'payout-1',
      status: SellerSettlementStatus.PAYOUT_PENDING,
    });
    prisma.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      status: PayoutStatus.FAILED,
    });
    prisma.sellerSettlement.update.mockResolvedValue({
      id: 'settlement-1',
      status: SellerSettlementStatus.FAILED,
    });

    const result = await service.reconcilePayout(
      'settlement-1',
    );

    expect(result.consistent).toBe(true);
    expect(result.action).toBe('MARKED_FAILED');
  });
});
