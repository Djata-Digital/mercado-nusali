import { Injectable, Logger } from '@nestjs/common';
import {
  CheckoutSessionStatus,
  OrderGroupStatus,
  Prisma,
  StockReservationStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { StockReservationsService } from '../../stock-reservations/stock-reservations.service';
import { CheckoutEventsService } from './checkout-events.service';
import { CheckoutExpirationService } from './checkout-expiration.service';
import { CheckoutTransactionService } from './checkout-transaction.service';

export interface CheckoutRecoverySummary {
  expiredSessions: number;
  releasedOrphanReservations: number;
  restoredExpiredEvents: number;
  flaggedInconsistencies: number;
}

/**
 * CheckoutRecoveryService
 *
 * Camada conservadora de recuperação operacional do Checkout.
 *
 * O serviço somente corrige automaticamente estados cuja reparação é inequívoca:
 * - CheckoutSession vencida que já pode ser tratada pelo fluxo normal de expiração;
 * - StockReservation ACTIVE e vencida ligada a CheckoutSession terminal;
 * - evento checkout.expired ausente para uma sessão que já está EXPIRED.
 *
 * Inconsistências ambíguas NÃO são "adivinhadas". Elas recebem um evento
 * checkout.recovery_required na Outbox para revisão/automação posterior.
 *
 * Este serviço não cria, captura, cancela ou estorna pagamentos e não altera
 * Wallet/Escrow.
 */
@Injectable()
export class CheckoutRecoveryService {
  private readonly logger = new Logger(CheckoutRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expirationService: CheckoutExpirationService,
    private readonly stockReservationsService: StockReservationsService,
    private readonly transactionService: CheckoutTransactionService,
    private readonly checkoutEventsService: CheckoutEventsService,
  ) {}

  /**
   * Executa uma varredura conservadora de recuperação.
   *
   * Cada subrotina possui idempotência própria, permitindo executar este método
   * por cron/worker múltiplas vezes sem duplicar liberação de estoque ou Outbox.
   */
  async recover(limit = 100): Promise<CheckoutRecoverySummary> {
    const safeLimit = this.normalizeLimit(limit);

    const expiredSessions =
      await this.expirationService.processExpiredSessions(safeLimit);
    const releasedOrphanReservations =
      await this.recoverExpiredReservationsFromTerminalSessions(safeLimit);
    const restoredExpiredEvents =
      await this.restoreMissingExpiredEvents(safeLimit);
    const flaggedInconsistencies =
      await this.flagAmbiguousInconsistencies(safeLimit);

    const summary: CheckoutRecoverySummary = {
      expiredSessions,
      releasedOrphanReservations,
      restoredExpiredEvents,
      flaggedInconsistencies,
    };

    this.logger.log(
      `Recovery concluído: ${JSON.stringify(summary)}`,
    );

    return summary;
  }

  /**
   * Libera reservas vencidas que permaneceram ACTIVE embora a CheckoutSession
   * associada já esteja em estado terminal (EXPIRED/CANCELLED).
   *
   * A liberação e o evento checkout.recovered são gravados no mesmo commit.
   */
  private async recoverExpiredReservationsFromTerminalSessions(
    limit: number,
  ): Promise<number> {
    const now = new Date();
    const candidates = await this.prisma.stockReservation.findMany({
      where: {
        status: StockReservationStatus.ACTIVE,
        expiresAt: { lte: now },
        orderGroup: {
          checkoutSession: {
            status: {
              in: [
                CheckoutSessionStatus.EXPIRED,
                CheckoutSessionStatus.CANCELLED,
              ],
            },
          },
        },
      },
      select: {
        id: true,
        orderGroup: {
          select: {
            checkoutSession: {
              select: {
                id: true,
                userId: true,
                cartId: true,
              },
            },
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    let recovered = 0;

    for (const candidate of candidates) {
      const processed = await this.transactionService.run(async (tx) => {
        const released =
          await this.stockReservationsService.expireSingleReservationInTransaction(
            tx,
            candidate.id,
          );

        if (!released) return false;

        const checkout = candidate.orderGroup.checkoutSession;
        await this.checkoutEventsService.recordCheckoutRecovered(tx, {
          userId: checkout.userId,
          checkoutSessionId: checkout.id,
          cartId: checkout.cartId,
          action: 'RELEASED_ORPHAN_EXPIRED_RESERVATION',
          referenceId: candidate.id,
        });

        return true;
      });

      if (processed) recovered += 1;
    }

    return recovered;
  }

  /**
   * Restaura checkout.expired quando a sessão já está EXPIRED mas o evento não
   * existe na Outbox. A checagem e a criação acontecem em Serializable para que
   * múltiplos recovery workers não criem eventos duplicados.
   */
  private async restoreMissingExpiredEvents(limit: number): Promise<number> {
    const sessions = await this.prisma.checkoutSession.findMany({
      where: { status: CheckoutSessionStatus.EXPIRED },
      select: {
        id: true,
        userId: true,
        cartId: true,
      },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    let restored = 0;

    for (const session of sessions) {
      const created = await this.transactionService.run(async (tx) => {
        const existing = await tx.outboxEvent.findFirst({
          where: {
            aggregateType: 'CheckoutSession',
            aggregateId: session.id,
            eventType: 'checkout.expired',
          },
          select: { id: true },
        });

        if (existing) return false;

        await this.checkoutEventsService.recordCheckoutExpired(tx, {
          userId: session.userId,
          checkoutSessionId: session.id,
          cartId: session.cartId,
        });

        await this.checkoutEventsService.recordCheckoutRecovered(tx, {
          userId: session.userId,
          checkoutSessionId: session.id,
          cartId: session.cartId,
          action: 'RESTORED_MISSING_CHECKOUT_EXPIRED_EVENT',
        });

        return true;
      });

      if (created) restored += 1;
    }

    return restored;
  }

  /**
   * Detecta estados estruturalmente incompatíveis com o fluxo transacional atual.
   * Eles são sinalizados, mas não alterados automaticamente.
   */
  private async flagAmbiguousInconsistencies(limit: number): Promise<number> {
    const issues: Array<{
      checkoutSessionId: string;
      userId: string;
      cartId: string;
      reason: string;
      referenceId?: string;
    }> = [];

    // Uma sessão CONFIRMED deveria possuir um OrderGroup, pois a confirmação é
    // transacional. Ausência pode indicar dado legado/corrompido.
    const confirmedWithoutGroup = await this.prisma.checkoutSession.findMany({
      where: {
        status: CheckoutSessionStatus.CONFIRMED,
        orderGroups: { none: {} },
      },
      select: { id: true, userId: true, cartId: true },
      take: limit,
    });

    for (const session of confirmedWithoutGroup) {
      issues.push({
        checkoutSessionId: session.id,
        userId: session.userId,
        cartId: session.cartId,
        reason: 'CONFIRMED_WITHOUT_ORDER_GROUP',
      });
    }

    // No fluxo atual, um OrderGroup PENDING_PAYMENT criado pelo Checkout sempre
    // recebe StockReservation na mesma transação. Não cancelamos automaticamente
    // porque integrações futuras podem introduzir pedidos que não reservam estoque.
    const remaining = Math.max(0, limit - issues.length);
    if (remaining > 0) {
      const groupsWithoutReservation = await this.prisma.orderGroup.findMany({
        where: {
          status: OrderGroupStatus.PENDING_PAYMENT,
          stockReservations: { none: {} },
          checkoutSession: { status: CheckoutSessionStatus.CONFIRMED },
        },
        select: {
          id: true,
          checkoutSession: {
            select: { id: true, userId: true, cartId: true },
          },
        },
        take: remaining,
      });

      for (const group of groupsWithoutReservation) {
        issues.push({
          checkoutSessionId: group.checkoutSession.id,
          userId: group.checkoutSession.userId,
          cartId: group.checkoutSession.cartId,
          reason: 'PENDING_ORDER_GROUP_WITHOUT_STOCK_RESERVATION',
          referenceId: group.id,
        });
      }
    }

    let flagged = 0;
    for (const issue of issues) {
      const created = await this.flagRecoveryRequired(issue);
      if (created) flagged += 1;
    }

    return flagged;
  }

  /** Cria no máximo um recovery_required por checkout + motivo. */
  private flagRecoveryRequired(input: {
    checkoutSessionId: string;
    userId: string;
    cartId: string;
    reason: string;
    referenceId?: string;
  }): Promise<boolean> {
    return this.transactionService.run(async (tx) => {
      const existing = await tx.outboxEvent.findFirst({
        where: {
          aggregateType: 'CheckoutSession',
          aggregateId: input.checkoutSessionId,
          eventType: 'checkout.recovery_required',
        },
        select: { id: true },
      });

      if (existing) return false;

      await this.checkoutEventsService.recordCheckoutRecoveryRequired(tx, input);
      return true;
    });
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit)) return 100;
    return Math.min(500, Math.max(1, Math.trunc(limit)));
  }
}
