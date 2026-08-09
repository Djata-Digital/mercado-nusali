import { Injectable, Logger } from '@nestjs/common';
import {
  CheckoutSessionStatus,
  Prisma,
  StockReservationStatus,
} from '@prisma/client';

import { StockReservationsService } from '../../stock-reservations/stock-reservations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutEventsService } from './checkout-events.service';
import { CheckoutTransactionService } from './checkout-transaction.service';

/**
 * CheckoutExpirationService
 *
 * Coordena a expiração operacional das CheckoutSessions sem duplicar regras de
 * estoque. Reservas são sempre liberadas pelo StockReservationsService.
 *
 * Casos tratados:
 * - CREATED vencida: apenas encerra a sessão e grava checkout.expired;
 * - CONFIRMED com reserva ACTIVE vencida: expira sessão, reserva, pedidos,
 *   cupom e estoque no MESMO TransactionClient;
 * - sessões terminais: execução idempotente, sem eventos duplicados.
 */
@Injectable()
export class CheckoutExpirationService {
  private readonly logger = new Logger(CheckoutExpirationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionService: CheckoutTransactionService,
    private readonly checkoutEventsService: CheckoutEventsService,
    private readonly stockReservationsService: StockReservationsService,
  ) {}

  /**
   * Expira uma sessão específica quando ela realmente estiver vencida.
   * Retorna true somente para a execução que reivindicar a sessão.
   */
  async expireSession(checkoutSessionId: string): Promise<boolean> {
    const processed = await this.transactionService.run((tx) =>
      this.expireSessionInTransaction(tx, checkoutSessionId),
    );

    if (processed) {
      this.logger.log(`CheckoutSession ${checkoutSessionId} expirada.`);
    }

    return processed;
  }

  /**
   * Processa sessões vencidas em lotes pequenos.
   *
   * O claim atômico dentro de expireSession() permite múltiplas instâncias do
   * worker sem duplicação de eventos ou dupla liberação de estoque.
   */
  async processExpiredSessions(limit = 100): Promise<number> {
    const now = new Date();
    const candidates = await this.prisma.checkoutSession.findMany({
      where: {
        OR: [
          {
            status: CheckoutSessionStatus.CREATED,
            expiresAt: { lte: now },
          },
          {
            status: CheckoutSessionStatus.CONFIRMED,
            orderGroups: {
              some: {
                stockReservations: {
                  some: {
                    status: StockReservationStatus.ACTIVE,
                    expiresAt: { lte: now },
                  },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    for (const candidate of candidates) {
      if (await this.expireSession(candidate.id)) processed += 1;
    }
    return processed;
  }

  private async expireSessionInTransaction(
    tx: Prisma.TransactionClient,
    checkoutSessionId: string,
  ): Promise<boolean> {
    const now = new Date();
    const session = await tx.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
      include: {
        orderGroups: {
          include: {
            stockReservations: {
              where: { status: StockReservationStatus.ACTIVE },
              orderBy: { expiresAt: 'asc' },
            },
          },
        },
      },
    });

    if (!session) return false;

    if (
      session.status === CheckoutSessionStatus.EXPIRED ||
      session.status === CheckoutSessionStatus.CANCELLED
    ) {
      return false;
    }

    if (session.status === CheckoutSessionStatus.CREATED) {
      if (session.expiresAt > now) return false;

      const claimed = await tx.checkoutSession.updateMany({
        where: {
          id: session.id,
          status: CheckoutSessionStatus.CREATED,
          expiresAt: { lte: now },
        },
        data: { status: CheckoutSessionStatus.EXPIRED },
      });

      if (claimed.count !== 1) return false;

      await this.checkoutEventsService.recordCheckoutExpired(tx, {
        userId: session.userId,
        checkoutSessionId: session.id,
        cartId: session.cartId,
      });
      return true;
    }

    if (session.status !== CheckoutSessionStatus.CONFIRMED) {
      return false;
    }

    const expiredReservations = session.orderGroups.flatMap((group) =>
      group.stockReservations.filter((reservation) => reservation.expiresAt <= now),
    );

    if (expiredReservations.length === 0) return false;

    // Primeiro reivindicamos a sessão. Isso impede dois workers de dispararem
    // checkout.expired para a mesma sessão confirmada.
    const claimed = await tx.checkoutSession.updateMany({
      where: {
        id: session.id,
        status: CheckoutSessionStatus.CONFIRMED,
      },
      data: { status: CheckoutSessionStatus.EXPIRED },
    });

    if (claimed.count !== 1) return false;

    let releasedAnyReservation = false;
    for (const reservation of expiredReservations) {
      const released =
        await this.stockReservationsService.expireSingleReservationInTransaction(
          tx,
          reservation.id,
        );
      releasedAnyReservation = releasedAnyReservation || released;
    }

    // Se a sessão foi reivindicada mas nenhuma reserva pôde ser reivindicada,
    // outra transação alterou o agregado. Abortamos para que o commit não deixe
    // CheckoutSession e reserva em estados divergentes.
    if (!releasedAnyReservation) {
      throw new Error('CHECKOUT_EXPIRATION_RESERVATION_NOT_CLAIMED');
    }

    await this.checkoutEventsService.recordCheckoutExpired(tx, {
      userId: session.userId,
      checkoutSessionId: session.id,
      cartId: session.cartId,
    });

    return true;
  }
}
