import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

export interface TransitionOrderStateInput {
  orderId: string;
  newStatus: OrderStatus;
  reason?: string;
  changedById?: string;
  metadataJson?: Record<string, any>;
}

@Injectable()
export class OrderStateMachineService {
  private readonly logger = new Logger(OrderStateMachineService.name);

  private readonly validTransitions: Record<OrderStatus, OrderStatus[]> = {
    DRAFT: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
    PENDING_PAYMENT: [
      OrderStatus.PAID,
      OrderStatus.CANCELLED,
      OrderStatus.EXPIRED,
      OrderStatus.FAILED,
    ],
    PAYMENT_PROCESSING: [OrderStatus.PAID, OrderStatus.FAILED, OrderStatus.CANCELLED],
    PAID: [OrderStatus.PROCESSING, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKING, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
    PREPARING: [OrderStatus.PROCESSING, OrderStatus.READY_FOR_PICKING, OrderStatus.CANCELLED],
    PROCESSING: [OrderStatus.READY_FOR_PICKING, OrderStatus.PICKING, OrderStatus.CANCELLED],
    READY_FOR_PICKING: [OrderStatus.PICKING, OrderStatus.CANCELLED],
    PICKING: [OrderStatus.PACKING, OrderStatus.CANCELLED],
    PACKING: [OrderStatus.READY_FOR_SHIPMENT, OrderStatus.CANCELLED],
    READY_FOR_SHIPMENT: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    SHIPPED: [OrderStatus.IN_TRANSIT, OrderStatus.CUSTOMS, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.LOST, OrderStatus.CANCELLED],
    IN_TRANSIT: [OrderStatus.CUSTOMS, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.LOST, OrderStatus.CANCELLED],
    CUSTOMS: [OrderStatus.IN_TRANSIT, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.LOST],
    DELIVERED: [OrderStatus.COMPLETED, OrderStatus.RETURN_REQUESTED, OrderStatus.REFUNDED],
    COMPLETED: [OrderStatus.RETURN_REQUESTED, OrderStatus.REFUNDED],
    CANCELLED: [],
    EXPIRED: [],
    FAILED: [],
    REFUNDED: [],
    LOST: [OrderStatus.REFUNDED],
    RETURN_REQUESTED: [OrderStatus.RETURNED, OrderStatus.COMPLETED, OrderStatus.REFUNDED],
    RETURNED: [OrderStatus.REFUNDED],
    DISPUTED: [OrderStatus.REFUNDED, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transiciona o status do pedido validando a matriz de estados e gravando atomicamente Histórico, Timeline e Outbox.
   */
  async transitionState(input: TransitionOrderStateInput, externalTx?: any) {
    const tx = externalTx || this.prisma;

    const order = await tx.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new BadRequestException(`Pedido id ${input.orderId} não encontrado.`);
    }

    const currentStatus = order.status;

    // Idempotência: Se já estiver no status desejado, não duplica ações
    if (currentStatus === input.newStatus) {
      return order;
    }

    const allowedNext = this.validTransitions[currentStatus] || [];
    if (!allowedNext.includes(input.newStatus)) {
      throw new BadRequestException(
        `Transição de status de pedido inválida: de '${currentStatus}' para '${input.newStatus}'.`,
      );
    }

    const executeTransition = async (db: any) => {
      // 1. Atualização condicional do status para trava de concorrência
      const updateResult = await db.order.updateMany({
        where: { id: input.orderId, status: currentStatus },
        data: {
          status: input.newStatus,
          cancelledAt: input.newStatus === OrderStatus.CANCELLED ? new Date() : order.cancelledAt,
          cancellationReason: input.newStatus === OrderStatus.CANCELLED ? input.reason : order.cancellationReason,
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Concorrência: o status do pedido foi alterado por outro processo simultâneo.');
      }

      const validActorId = input.changedById && input.changedById !== 'anonymous' ? input.changedById : null;

      // 2. Registrar no Histórico do Pedido
      await db.orderStatusHistory.create({
        data: {
          orderId: input.orderId,
          previousStatus: currentStatus,
          newStatus: input.newStatus,
          reason: input.reason,
          changedById: validActorId,
          metadataJson: input.metadataJson as any,
        },
      });

      // 3. Registrar na Timeline do Pedido
      await db.orderTimeline.create({
        data: {
          orderId: input.orderId,
          eventCode: `ORDER_${input.newStatus}`,
          title: `Status alterado para ${input.newStatus}`,
          description: input.reason || `Transição de ${currentStatus} para ${input.newStatus}`,
          actorId: validActorId,
          metadataJson: input.metadataJson as any,
        },
      });

      // 4. Emitir Evento Outbox
      const eventType = input.newStatus === OrderStatus.CANCELLED ? 'order.cancelled' : 'order.updated';
      await db.outboxEvent.create({
        data: {
          aggregateType: 'Order',
          aggregateId: input.orderId,
          eventType,
          payloadJson: {
            orderId: input.orderId,
            previousStatus: currentStatus,
            newStatus: input.newStatus,
            reason: input.reason,
          },
        },
      });

      return db.order.findUnique({ where: { id: input.orderId } });
    };

    if (externalTx) {
      return executeTransition(externalTx);
    } else {
      return this.prisma.$transaction(executeTransition);
    }
  }
}
