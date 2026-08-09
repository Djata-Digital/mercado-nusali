import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  MovementType,
  Prisma,
  StockReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ReservationWithExpirationRelations = Prisma.StockReservationGetPayload<{
  include: {
    items: true;
    orderGroup: { include: { orders: true; couponRedemptions: true } };
  };
}>;

/**
 * StockReservationsService
 *
 * Fonte única de verdade para o ciclo de vida das reservas de estoque.
 *
 * Responsabilidades deste serviço:
 * - reivindicar uma reserva de forma atômica antes de processá-la;
 * - devolver ao estoque as quantidades reservadas;
 * - registrar movimentos imutáveis de inventário;
 * - manter OrderGroup/Orders coerentes quando uma reserva expira;
 * - devolver a utilização de cupons quando o checkout expira;
 * - registrar eventos de domínio na Outbox dentro da mesma transação;
 * - garantir idempotência em execuções repetidas por workers diferentes.
 *
 * Importante:
 * O schema atual não possui uma tabela ReservationHistory. O histórico operacional
 * dos itens é preservado em InventoryMovement e as transições da reserva são
 * registradas pela própria StockReservation + OutboxEvent. Não criamos um segundo
 * modelo de histórico sem migration apenas para "simular" essa funcionalidade.
 */
@Injectable()
export class StockReservationsService {
  private readonly logger = new Logger(StockReservationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Expira uma reserva ativa e devolve integralmente o estoque reservado.
   *
   * Idempotência:
   * somente a execução que conseguir fazer ACTIVE -> EXPIRED continuará.
   * Chamadas posteriores retornam false e não duplicam estoque, movimentos ou
   * eventos de Outbox.
   */
  async expireSingleReservation(reservationId: string): Promise<boolean> {
    const processed = await this.prisma.$transaction((tx) =>
      this.expireSingleReservationInTransaction(tx, reservationId),
    );

    if (processed) {
      this.logger.log(`Reserva ${reservationId} expirada e estoque liberado com sucesso.`);
    }

    return processed;
  }

  /**
   * Variante transacional reutilizável por outros agregados.
   *
   * Permite que CheckoutExpirationService expire a CheckoutSession e a reserva
   * no mesmo commit PostgreSQL, sem abrir transações aninhadas.
   */
  async expireSingleReservationInTransaction(
    tx: Prisma.TransactionClient,
    reservationId: string,
  ): Promise<boolean> {
    const releasedAt = new Date();
    const claimed = await this.claimReservation(
      tx,
      reservationId,
      StockReservationStatus.EXPIRED,
      releasedAt,
    );

    if (!claimed) return false;

    const reservation = await this.loadReservationForExpiration(tx, reservationId);

    if (!reservation) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A reserva não pôde ser carregada após a reivindicação.',
        errorCode: 'STOCK_RESERVATION_STATE_INCONSISTENT',
      });
    }

    await this.releaseInventory(tx, reservation, 'CHECKOUT_EXPIRED');
    await this.expireOrders(tx, reservation, releasedAt);
    await this.cancelCoupons(tx, reservation, releasedAt);

    await this.recordOutboxEvent(tx, {
      aggregateId: reservation.id,
      eventType: 'reservation.released',
      payload: {
        reservationId: reservation.id,
        orderGroupId: reservation.orderGroupId,
        releasedAt: releasedAt.toISOString(),
        reason: 'CHECKOUT_EXPIRED',
        releasedItems: reservation.items.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          warehouseId: item.warehouseId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      },
    });

    await this.recordOutboxEvent(tx, {
      aggregateId: reservation.id,
      eventType: 'reservation.expired',
      payload: {
        reservationId: reservation.id,
        orderGroupId: reservation.orderGroupId,
        expiredAt: releasedAt.toISOString(),
      },
    });

    return true;
  }

  /**
   * Varredura de recuperação para reservas ACTIVE cujo prazo já venceu.
   *
   * O método é propositalmente simples: a proteção contra processamento duplo
   * permanece em expireSingleReservation(), permitindo executar esta rotina em
   * múltiplas instâncias/cron jobs sem dupla liberação de estoque.
   */
  async processExpiredReservations(): Promise<number> {
    const now = new Date();
    const expiredReservations = await this.prisma.stockReservation.findMany({
      where: {
        status: StockReservationStatus.ACTIVE,
        expiresAt: { lt: now },
      },
      select: { id: true },
    });

    let processedCount = 0;

    for (const reservation of expiredReservations) {
      const processed = await this.expireSingleReservation(reservation.id);
      if (processed) processedCount += 1;
    }

    return processedCount;
  }

  /**
   * Reivindica atomicamente uma reserva ativa para processamento.
   *
   * updateMany é usado intencionalmente: duas instâncias concorrentes podem ler
   * o mesmo job, mas apenas uma conseguirá alterar status ACTIVE.
   */
  private async claimReservation(
    tx: Prisma.TransactionClient,
    reservationId: string,
    targetStatus: StockReservationStatus,
    releasedAt: Date,
  ): Promise<boolean> {
    const result = await tx.stockReservation.updateMany({
      where: {
        id: reservationId,
        status: StockReservationStatus.ACTIVE,
      },
      data: {
        status: targetStatus,
        releasedAt,
      },
    });

    return result.count === 1;
  }

  /** Carrega somente as relações necessárias para a expiração. */
  private loadReservationForExpiration(
    tx: Prisma.TransactionClient,
    reservationId: string,
  ): Promise<ReservationWithExpirationRelations | null> {
    return tx.stockReservation.findUnique({
      where: { id: reservationId },
      include: {
        items: true,
        orderGroup: {
          include: {
            orders: true,
            couponRedemptions: true,
          },
        },
      },
    });
  }

  /**
   * Libera fisicamente todas as parcelas da reserva.
   *
   * quantityAvailable no projeto representa o saldo comercial livre. Ao criar a
   * reserva esse saldo foi decrementado e quantityReserved incrementado; portanto
   * a liberação executa exatamente a operação inversa.
   */
  private async releaseInventory(
    tx: Prisma.TransactionClient,
    reservation: ReservationWithExpirationRelations,
    reason: string,
  ): Promise<void> {
    for (const item of reservation.items) {
      const update = await tx.inventoryItem.updateMany({
        where: {
          id: item.inventoryItemId,
          quantityReserved: { gte: item.quantity },
        },
        data: {
          quantityReserved: { decrement: item.quantity },
          quantityAvailable: { increment: item.quantity },
        },
      });

      if (update.count !== 1) {
        throw new ConflictException({
          statusCode: 409,
          message: 'O estoque reservado foi alterado concorrentemente.',
          errorCode: 'STOCK_RESERVATION_INVENTORY_CONFLICT',
          reservationId: reservation.id,
          inventoryItemId: item.inventoryItemId,
        });
      }

      const inventory = await tx.inventoryItem.findUnique({
        where: { id: item.inventoryItemId },
        select: { quantityAvailable: true },
      });

      if (!inventory) {
        throw new ConflictException({
          statusCode: 409,
          message: 'O item de inventário da reserva não existe mais.',
          errorCode: 'STOCK_RESERVATION_INVENTORY_NOT_FOUND',
          reservationId: reservation.id,
          inventoryItemId: item.inventoryItemId,
        });
      }

      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.inventoryItemId,
          type: MovementType.RELEASE,
          quantity: item.quantity,
          previousQuantity: inventory.quantityAvailable - item.quantity,
          newQuantity: inventory.quantityAvailable,
          reason,
          referenceType: 'STOCK_RESERVATION',
          referenceId: reservation.id,
        },
      });
    }
  }

  /** Mantém OrderGroup, Orders e histórico de status coerentes com a expiração. */
  private async expireOrders(
    tx: Prisma.TransactionClient,
    reservation: ReservationWithExpirationRelations,
    expiredAt: Date,
  ): Promise<void> {
    if (!reservation.orderGroup || reservation.orderGroup.status !== 'PENDING_PAYMENT') {
      return;
    }

    await tx.orderGroup.updateMany({
      where: {
        id: reservation.orderGroupId,
        status: 'PENDING_PAYMENT',
      },
      data: { status: 'EXPIRED' },
    });

    for (const order of reservation.orderGroup.orders) {
      if (order.status !== 'PENDING_PAYMENT') continue;

      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          status: 'PENDING_PAYMENT',
        },
        data: {
          status: 'EXPIRED',
          cancellationReason: 'Expiração automática por falta de pagamento',
        },
      });

      // Se outra transação já avançou o pedido, não sobrescrevemos o novo estado.
      if (updated.count !== 1) continue;

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: 'PENDING_PAYMENT',
          newStatus: 'EXPIRED',
          reason: 'Prazo de pagamento expirado',
          metadataJson: {
            reservationId: reservation.id,
            expiredAt: expiredAt.toISOString(),
          },
        },
      });
    }
  }

  /**
   * Cancela resgates de cupom ainda ativos e devolve o contador de uso sem
   * permitir valores negativos.
   */
  private async cancelCoupons(
    tx: Prisma.TransactionClient,
    reservation: ReservationWithExpirationRelations,
    cancelledAt: Date,
  ): Promise<void> {
    if (!reservation.orderGroup) return;

    for (const redemption of reservation.orderGroup.couponRedemptions) {
      if (redemption.status !== 'ACTIVE') continue;

      const cancelled = await tx.couponRedemption.updateMany({
        where: {
          id: redemption.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt,
        },
      });

      if (cancelled.count !== 1) continue;

      await tx.coupon.updateMany({
        where: {
          id: redemption.couponId,
          currentUsageCount: { gt: 0 },
        },
        data: {
          currentUsageCount: { decrement: 1 },
        },
      });
    }
  }

  /** Registra eventos críticos somente na Outbox e sempre no mesmo commit. */
  private async recordOutboxEvent(
    tx: Prisma.TransactionClient,
    input: {
      aggregateId: string;
      eventType: string;
      payload: Prisma.InputJsonObject;
    },
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: 'StockReservation',
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payloadJson: {
          eventVersion: 1,
          ...input.payload,
        },
      },
    });
  }
}
