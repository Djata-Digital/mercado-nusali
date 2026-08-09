import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayoutStatus,
  Prisma,
  SellerSettlementStatus,
} from '@prisma/client';

import { PayoutsService } from '../payouts/payouts.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementsService } from './settlements.service';

@Injectable()
export class SettlementPayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlements: SettlementsService,
    private readonly payouts: PayoutsService,
  ) {}

  async requestPayout(batchId: string, sellerId: string) {
    // Idempotência precisa ser verificada ANTES da elegibilidade.
    // Após a primeira chamada, o settlement deixa READY e passa a
    // PAYOUT_PENDING; portanto uma segunda chamada legítima não deve
    // ser rejeitada por payoutEligibility().
    const existing =
      await this.prisma.sellerSettlement.findUnique({
        where: {
          batchId_sellerId: { batchId, sellerId },
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Settlement do vendedor não encontrado.',
      );
    }

    if (existing.payoutId) {
      const payout = await this.prisma.payout.findUnique({
        where: { id: existing.payoutId },
      });

      return {
        idempotent: true,
        settlement: existing,
        payout,
      };
    }

    if (
      existing.status ===
      SellerSettlementStatus.PAYOUT_PENDING
    ) {
      throw new ConflictException(
        'Outro worker já iniciou o payout deste settlement.',
      );
    }

    const eligibility =
      await this.settlements.payoutEligibility(batchId, sellerId);

    if (!eligibility.eligible) {
      throw new BadRequestException({
        message: 'Settlement não elegível para payout.',
        reasons: eligibility.reasons,
      });
    }

    const claimed = await this.prisma.sellerSettlement.updateMany({
      where: {
        batchId,
        sellerId,
        status: SellerSettlementStatus.READY,
        payoutId: null,
      },
      data: {
        status: SellerSettlementStatus.PAYOUT_PENDING,
        payoutRequestedAt: new Date(),
      },
    });

    if (claimed.count !== 1) {
      const current =
        await this.prisma.sellerSettlement.findUnique({
          where: {
            batchId_sellerId: { batchId, sellerId },
          },
        });

      if (!current) {
        throw new NotFoundException(
          'Settlement do vendedor não encontrado.',
        );
      }

      if (current.payoutId) {
        const payout = await this.prisma.payout.findUnique({
          where: { id: current.payoutId },
        });

        return {
          idempotent: true,
          settlement: current,
          payout,
        };
      }

      throw new ConflictException(
        'Outro worker já iniciou o payout deste settlement.',
      );
    }

    const seller = await this.prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { id: true, userId: true },
    });

    if (!seller) {
      await this.restoreReady(batchId, sellerId);
      throw new NotFoundException(
        'Perfil do vendedor não encontrado.',
      );
    }

    let payout: Awaited<
      ReturnType<PayoutsService['requestPayout']>
    >;

    try {
      payout = await this.payouts.requestPayout(
        seller.userId,
        new Prisma.Decimal(eligibility.payoutAmount),
        eligibility.currencyId,
        'SETTLEMENT',
      );
    } catch (error) {
      await this.restoreReady(batchId, sellerId);
      throw error;
    }

    try {
      const settlement =
        await this.prisma.sellerSettlement.update({
          where: {
            batchId_sellerId: { batchId, sellerId },
          },
          data: {
            payoutId: payout.id,
          },
        });

      return {
        idempotent: false,
        settlement,
        payout,
      };
    } catch (error) {
      try {
        await this.payouts.cancelPayout(
          seller.userId,
          payout.id,
        );
      } finally {
        await this.restoreReady(batchId, sellerId);
      }
      throw error;
    }
  }

  async processPayout(settlementId: string) {
    const settlement =
      await this.prisma.sellerSettlement.findUnique({
        where: { id: settlementId },
      });

    if (!settlement) {
      throw new NotFoundException(
        'Settlement do vendedor não encontrado.',
      );
    }

    if (
      settlement.status === SellerSettlementStatus.SETTLED
    ) {
      return {
        idempotent: true,
        settlement,
      };
    }

    if (
      settlement.status !==
        SellerSettlementStatus.PAYOUT_PENDING ||
      !settlement.payoutId
    ) {
      throw new ConflictException(
        'Settlement não possui payout pendente para processamento.',
      );
    }

    const payout = await this.payouts.processPayout(
      settlement.payoutId,
    );

    if (payout.status !== PayoutStatus.PAID) {
      throw new ConflictException(
        'Payout não convergiu para PAID.',
      );
    }

    const updated =
      await this.prisma.sellerSettlement.updateMany({
        where: {
          id: settlement.id,
          payoutId: payout.id,
          status: SellerSettlementStatus.PAYOUT_PENDING,
        },
        data: {
          status: SellerSettlementStatus.SETTLED,
          settledAt: new Date(),
        },
      });

    if (updated.count !== 1) {
      const current =
        await this.prisma.sellerSettlement.findUniqueOrThrow({
          where: { id: settlement.id },
        });

      if (
        current.status !== SellerSettlementStatus.SETTLED
      ) {
        throw new ConflictException(
          'Settlement foi alterado por outro worker.',
        );
      }

      return {
        idempotent: true,
        settlement: current,
        payout,
      };
    }

    return {
      idempotent: false,
      settlement:
        await this.prisma.sellerSettlement.findUniqueOrThrow({
          where: { id: settlement.id },
        }),
      payout,
    };
  }

  async reconcilePayout(settlementId: string) {
    const settlement =
      await this.prisma.sellerSettlement.findUnique({
        where: { id: settlementId },
      });

    if (!settlement) {
      throw new NotFoundException(
        'Settlement do vendedor não encontrado.',
      );
    }

    if (!settlement.payoutId) {
      return {
        consistent:
          settlement.status !==
          SellerSettlementStatus.PAYOUT_PENDING,
        settlementStatus: settlement.status,
        payoutStatus: null,
        action: 'NO_PAYOUT_LINK',
      };
    }

    const payout = await this.prisma.payout.findUnique({
      where: { id: settlement.payoutId },
    });

    if (!payout) {
      return {
        consistent: false,
        settlementStatus: settlement.status,
        payoutStatus: null,
        action: 'PAYOUT_NOT_FOUND',
      };
    }

    if (payout.status === PayoutStatus.PAID) {
      if (
        settlement.status !== SellerSettlementStatus.SETTLED
      ) {
        const updated =
          await this.prisma.sellerSettlement.update({
            where: { id: settlement.id },
            data: {
              status: SellerSettlementStatus.SETTLED,
              settledAt:
                settlement.settledAt ?? new Date(),
            },
          });

        return {
          consistent: true,
          settlementStatus: updated.status,
          payoutStatus: payout.status,
          action: 'MARKED_SETTLED',
        };
      }

      return {
        consistent: true,
        settlementStatus: settlement.status,
        payoutStatus: payout.status,
        action: 'NONE',
      };
    }

    if (
      payout.status === PayoutStatus.FAILED ||
      payout.status === PayoutStatus.CANCELLED
    ) {
      if (
        settlement.status ===
        SellerSettlementStatus.PAYOUT_PENDING
      ) {
        const updated =
          await this.prisma.sellerSettlement.update({
            where: { id: settlement.id },
            data: {
              status: SellerSettlementStatus.FAILED,
            },
          });

        return {
          consistent: true,
          settlementStatus: updated.status,
          payoutStatus: payout.status,
          action: 'MARKED_FAILED',
        };
      }
    }

    return {
      consistent:
        settlement.status ===
          SellerSettlementStatus.PAYOUT_PENDING &&
        (payout.status === PayoutStatus.CREATED ||
          payout.status === PayoutStatus.PROCESSING),
      settlementStatus: settlement.status,
      payoutStatus: payout.status,
      action: 'NONE',
    };
  }

  private async restoreReady(
    batchId: string,
    sellerId: string,
  ) {
    await this.prisma.sellerSettlement.updateMany({
      where: {
        batchId,
        sellerId,
        status: SellerSettlementStatus.PAYOUT_PENDING,
        payoutId: null,
      },
      data: {
        status: SellerSettlementStatus.READY,
        payoutRequestedAt: null,
      },
    });
  }
}
