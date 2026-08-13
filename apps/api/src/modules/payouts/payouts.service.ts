import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayoutStatus,
  Prisma,
  SellerStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { WalletTransactionService } from '../wallet/services/wallet-transaction.service';
import { WalletService } from '../wallet/wallet.service';
import { PayoutEventsService } from './services/payout-events.service';
import { PayoutReconciliationService } from './services/payout-reconciliation.service';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly walletTransactionService: WalletTransactionService,
    private readonly payoutEvents: PayoutEventsService,
    private readonly reconciliation: PayoutReconciliationService,
  ) {}

  /**
   * Cria o payout e bloqueia saldo na MESMA transação Serializable.
   * O dinheiro não sai da Wallet neste momento; available -> blocked.
   */
  async requestPayout(
    userId: string,
    amount: number | Prisma.Decimal,
    currencyId: string,
    payoutMethod = 'BANK_TRANSFER',
  ) {
    const amountDec = new Prisma.Decimal(amount);
    if (!amountDec.isFinite() || amountDec.lte(0)) {
      throw new BadRequestException(
        'O valor do repasse deve ser maior que zero.',
      );
    }

    return this.walletTransactionService.run(async (tx) => {
      const seller = await tx.sellerProfile.findUnique({
        where: { userId },
      });

      if (!seller || seller.status !== SellerStatus.VERIFIED) {
        throw new ForbiddenException(
          'Apenas vendedores verificados podem solicitar repasses.',
        );
      }

      const payout = await tx.payout.create({
        data: {
          sellerId: seller.id,
          amount: amountDec,
          currencyId,
          payoutMethod,
          status: PayoutStatus.CREATED,
        },
      });

      await this.walletService.reserveBalance(
        userId,
        amountDec,
        currencyId,
        'Payout',
        payout.id,
        `Saldo reservado para payout ${payout.id}`,
        tx,
      );

      await this.payoutEvents.enqueue(tx, payout.id, 'payout.requested', {
        payoutId: payout.id,
        sellerId: seller.id,
        amount: amountDec.toString(),
        currencyId,
      });

      return payout;
    });
  }

  /**
   * Claim CREATED -> PROCESSING por CAS e conclusão financeira em um único
   * TransactionClient. Um segundo worker não pode pagar novamente.
   */
  async processPayout(payoutId: string) {
    return this.walletTransactionService.run(async (tx) => {
      const payout = await tx.payout.findUnique({
        where: { id: payoutId },
        include: { seller: true },
      });

      if (!payout) {
        throw new NotFoundException('Solicitação de repasse não encontrada.');
      }

      if (payout.status === PayoutStatus.PAID) {
        return payout;
      }

      if (payout.status !== PayoutStatus.CREATED) {
        throw new ConflictException(
          'O payout não está disponível para processamento.',
        );
      }

      const claimed = await tx.payout.updateMany({
        where: {
          id: payout.id,
          status: PayoutStatus.CREATED,
        },
        data: {
          status: PayoutStatus.PROCESSING,
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException(
          'Outro worker já reivindicou este payout.',
        );
      }

      await this.walletService.captureReservedPayoutInTransaction(tx, {
        userId: payout.seller.userId,
        amount: payout.amount,
        currencyId: payout.currencyId,
        payoutId: payout.id,
        description: `Payout ${payout.id} enviado ao gateway`,
      });

      const paid = await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.PAID,
          processedAt: new Date(),
        },
      });

      await this.payoutEvents.enqueue(tx, payout.id, 'payout.paid', {
        payoutId: payout.id,
        sellerId: payout.sellerId,
        amount: payout.amount.toString(),
        currencyId: payout.currencyId,
      });

      return paid;
    });
  }

  /**
   * Cancela payout ainda não processado e desbloqueia o saldo.
   */
  async cancelPayout(userId: string, payoutId: string) {
    return this.walletTransactionService.run(async (tx) => {
      const payout = await tx.payout.findUnique({
        where: { id: payoutId },
        include: { seller: true },
      });

      if (!payout) {
        throw new NotFoundException('Solicitação de repasse não encontrada.');
      }

      if (payout.seller.userId !== userId) {
        throw new ForbiddenException(
          'Este payout não pertence ao usuário autenticado.',
        );
      }

      if (payout.status === PayoutStatus.CANCELLED) {
        return payout;
      }

      if (payout.status !== PayoutStatus.CREATED) {
        throw new ConflictException(
          'Apenas payouts ainda não processados podem ser cancelados.',
        );
      }

      const claimed = await tx.payout.updateMany({
        where: { id: payout.id, status: PayoutStatus.CREATED },
        data: { status: PayoutStatus.CANCELLED },
      });

      if (claimed.count !== 1) {
        throw new ConflictException(
          'Outro worker alterou o payout antes do cancelamento.',
        );
      }

      await this.walletService.releaseReservedBalance(
        userId,
        payout.amount,
        payout.currencyId,
        'Payout',
        payout.id,
        `Saldo devolvido pelo cancelamento do payout ${payout.id}`,
        tx,
      );

      await this.payoutEvents.enqueue(tx, payout.id, 'payout.cancelled', {
        payoutId: payout.id,
        sellerId: payout.sellerId,
        amount: payout.amount.toString(),
      });

      return tx.payout.findUniqueOrThrow({ where: { id: payout.id } });
    });
  }

  /**
   * Marca falha operacional antes do débito efetivo e devolve saldo bloqueado.
   * Não deve ser usado depois de PAID.
   */
  async failPayout(payoutId: string, reason = 'PROVIDER_FAILURE') {
    return this.walletTransactionService.run(async (tx) => {
      const payout = await tx.payout.findUnique({
        where: { id: payoutId },
        include: { seller: true },
      });

      if (!payout) {
        throw new NotFoundException('Solicitação de repasse não encontrada.');
      }

      if (payout.status === PayoutStatus.FAILED) {
        return payout;
      }

      if (
        payout.status !== PayoutStatus.CREATED &&
        payout.status !== PayoutStatus.PROCESSING
      ) {
        throw new ConflictException(
          'O payout não pode ser marcado como falho neste estado.',
        );
      }

      const claimed = await tx.payout.updateMany({
        where: {
          id: payout.id,
          status: payout.status,
        },
        data: {
          status: PayoutStatus.FAILED,
          processedAt: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException(
          'Outro worker alterou o payout antes da falha.',
        );
      }

      await this.walletService.releaseReservedBalance(
        payout.seller.userId,
        payout.amount,
        payout.currencyId,
        'Payout',
        payout.id,
        `Saldo devolvido após falha do payout ${payout.id}`,
        tx,
      );

      await this.payoutEvents.enqueue(tx, payout.id, 'payout.failed', {
        payoutId: payout.id,
        sellerId: payout.sellerId,
        amount: payout.amount.toString(),
        reason,
      });

      return tx.payout.findUniqueOrThrow({ where: { id: payout.id } });
    });
  }

  async listAdminPayouts(query?: {
    status?: string;
    sellerId?: string;
    limit?: number;
  }) {
    const limit = Math.min(
      Math.max(
        Number(query?.limit) || 100,
        1,
      ),
      200,
    );

    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.sellerId) {
      where.sellerId =
        query.sellerId;
    }

    return this.prisma.payout.findMany({
      where,

      take: limit,

      orderBy: {
        createdAt: 'desc',
      },

      include: {
        currency: true,

        seller: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },

            stores: {
              select: {
                id: true,
                name: true,
                slug: true,
              },

              take: 1,
            },
          },
        },
      },
    });
  }

  async listSellerPayouts(userId: string) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });
    if (!seller) {
      throw new NotFoundException('Perfil de vendedor não encontrado.');
    }

    return this.prisma.payout.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
      include: { currency: true },
    });
  }

  async reconcilePayout(payoutId: string) {
    return this.reconciliation.reconcileOne(payoutId);
  }

  async listReconciliationIssues(limit?: number) {
    return this.reconciliation.listInconsistent(limit);
  }
}
