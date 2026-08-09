import * as crypto from 'crypto';
import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingStatus, TrackingEventSource, OrderStatus, ShipmentStatus } from '@prisma/client';

export interface ProcessTrackingEventInput {
  trackingId: string;
  eventCode: string;
  status: TrackingStatus;
  title: string;
  description?: string;
  countryId?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  hubId?: string;
  carrierEventId?: string;
  externalEventId?: string;
  source?: TrackingEventSource;
  eventAt: Date;
  metadataJson?: Record<string, any>;
  changedById?: string;
}

@Injectable()
export class TrackingStateMachineService {
  // Matriz explícita de transições de status permitidas (Grafo de Estados Logísticos)
  private readonly allowedTransitions: Record<TrackingStatus, TrackingStatus[]> = {
    LABEL_CREATED: [
      TrackingStatus.PICKUP_SCHEDULED,
      TrackingStatus.PICKED_UP,
      TrackingStatus.RECEIVED_AT_ORIGIN_HUB,
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.CANCELLED,
      TrackingStatus.EXCEPTION,
    ],
    PICKUP_SCHEDULED: [
      TrackingStatus.PICKED_UP,
      TrackingStatus.RECEIVED_AT_ORIGIN_HUB,
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.DELIVERY_FAILED,
      TrackingStatus.CANCELLED,
      TrackingStatus.EXCEPTION,
    ],
    PICKED_UP: [
      TrackingStatus.RECEIVED_AT_ORIGIN_HUB,
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.ARRIVED_AT_TRANSIT_HUB,
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.EXCEPTION,
      TrackingStatus.LOST,
      TrackingStatus.DAMAGED,
    ],
    RECEIVED_AT_ORIGIN_HUB: [
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.ARRIVED_AT_TRANSIT_HUB,
      TrackingStatus.DEPARTED_TRANSIT_HUB,
      TrackingStatus.CUSTOMS_PENDING,
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.EXCEPTION,
      TrackingStatus.LOST,
      TrackingStatus.DAMAGED,
    ],
    IN_TRANSIT: [
      TrackingStatus.ARRIVED_AT_TRANSIT_HUB,
      TrackingStatus.DEPARTED_TRANSIT_HUB,
      TrackingStatus.ARRIVED_AT_DESTINATION_HUB,
      TrackingStatus.CUSTOMS_PENDING,
      TrackingStatus.CUSTOMS_CLEARED,
      TrackingStatus.CUSTOMS_HELD,
      TrackingStatus.READY_FOR_DELIVERY,
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.DELIVERY_ATTEMPTED,
      TrackingStatus.DELIVERED,
      TrackingStatus.EXCEPTION,
      TrackingStatus.LOST,
      TrackingStatus.DAMAGED,
    ],
    ARRIVED_AT_TRANSIT_HUB: [
      TrackingStatus.DEPARTED_TRANSIT_HUB,
      TrackingStatus.CUSTOMS_PENDING,
      TrackingStatus.ARRIVED_AT_DESTINATION_HUB,
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.EXCEPTION,
      TrackingStatus.LOST,
      TrackingStatus.DAMAGED,
    ],
    DEPARTED_TRANSIT_HUB: [
      TrackingStatus.ARRIVED_AT_DESTINATION_HUB,
      TrackingStatus.CUSTOMS_PENDING,
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.EXCEPTION,
      TrackingStatus.LOST,
      TrackingStatus.DAMAGED,
    ],
    ARRIVED_AT_DESTINATION_HUB: [
      TrackingStatus.READY_FOR_DELIVERY,
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.CUSTOMS_PENDING,
      TrackingStatus.EXCEPTION,
      TrackingStatus.LOST,
      TrackingStatus.DAMAGED,
    ],
    CUSTOMS_PENDING: [
      TrackingStatus.CUSTOMS_CLEARED,
      TrackingStatus.CUSTOMS_HELD,
      TrackingStatus.RETURN_REQUESTED,
      TrackingStatus.EXCEPTION,
    ],
    CUSTOMS_CLEARED: [
      TrackingStatus.ARRIVED_AT_DESTINATION_HUB,
      TrackingStatus.READY_FOR_DELIVERY,
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.IN_TRANSIT,
    ],
    CUSTOMS_HELD: [
      TrackingStatus.CUSTOMS_CLEARED,
      TrackingStatus.RETURN_REQUESTED,
      TrackingStatus.EXCEPTION,
    ],
    READY_FOR_DELIVERY: [
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.DELIVERY_ATTEMPTED,
      TrackingStatus.DELIVERED,
      TrackingStatus.DELIVERY_FAILED,
      TrackingStatus.EXCEPTION,
    ],
    OUT_FOR_DELIVERY: [
      TrackingStatus.DELIVERY_ATTEMPTED,
      TrackingStatus.DELIVERED,
      TrackingStatus.DELIVERY_FAILED,
      TrackingStatus.RETURN_REQUESTED,
      TrackingStatus.EXCEPTION,
    ],
    DELIVERY_ATTEMPTED: [
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.DELIVERED,
      TrackingStatus.DELIVERY_FAILED,
      TrackingStatus.RETURN_REQUESTED,
      TrackingStatus.EXCEPTION,
    ],
    DELIVERED: [], // Estado Terminal
    DELIVERY_FAILED: [
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.RETURN_REQUESTED,
      TrackingStatus.RETURN_IN_TRANSIT,
      TrackingStatus.RETURNED,
      TrackingStatus.EXCEPTION,
    ],
    RETURN_REQUESTED: [
      TrackingStatus.RETURN_IN_TRANSIT,
      TrackingStatus.RETURNED,
      TrackingStatus.EXCEPTION,
    ],
    RETURN_IN_TRANSIT: [
      TrackingStatus.RETURNED,
      TrackingStatus.EXCEPTION,
    ],
    RETURNED: [], // Estado Terminal
    LOST: [TrackingStatus.EXCEPTION],
    DAMAGED: [TrackingStatus.EXCEPTION],
    CANCELLED: [], // Estado Terminal
    EXCEPTION: [
      TrackingStatus.IN_TRANSIT,
      TrackingStatus.OUT_FOR_DELIVERY,
      TrackingStatus.DELIVERED,
      TrackingStatus.RETURN_REQUESTED,
      TrackingStatus.LOST,
      TrackingStatus.DAMAGED,
    ],
  };

  private readonly terminalStates = new Set<TrackingStatus>([
    TrackingStatus.DELIVERED,
    TrackingStatus.RETURNED,
    TrackingStatus.LOST,
    TrackingStatus.CANCELLED,
    TrackingStatus.DAMAGED,
  ]);

  constructor(private readonly prisma: PrismaService) {}

  private getCanonicalJson(obj: any): string {
    if (obj === null || obj === undefined) return '';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map((item) => this.getCanonicalJson(item)).join(',') + ']';
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map((key) => `${JSON.stringify(key)}:${this.getCanonicalJson(obj[key])}`);
    return '{' + parts.join(',') + '}';
  }

  private generateDeduplicationKey(tracking: any, input: ProcessTrackingEventInput): string {
    const carrierEventId = input.carrierEventId || input.externalEventId;
    if (carrierEventId) {
      const raw = `${tracking.carrierId}:${carrierEventId}`;
      return crypto.createHash('sha256').update(raw).digest('hex');
    }
    const canonicalMetadata = this.getCanonicalJson(input.metadataJson || {});
    const raw = `${tracking.trackingNumber}:${input.eventCode}:${input.eventAt.toISOString()}:${canonicalMetadata}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Processa um evento de rastreamento com validação de transição, detecção de fora-de-ordem e atualizações atômicas.
   * Aceita um transaction client (tx) opcional para execução na mesma transação.
   */
  async processEvent(input: ProcessTrackingEventInput, externalTx?: any) {
    const executeInTx = async (tx: any) => {
      const tracking = await tx.tracking.findUnique({
        where: { id: input.trackingId },
        include: {
          shipment: {
            include: { order: true },
          },
        },
      });

      if (!tracking) {
        throw new BadRequestException(`Rastreamento id ${input.trackingId} não encontrado.`);
      }

      // 1. Gerar chave de deduplicação idempotente com Hash SHA-256 e JSON Canônico
      const carrierEventId = input.carrierEventId || input.externalEventId || '';
      const deduplicationKey = this.generateDeduplicationKey(tracking, input);

      // 2. Verificar se o evento já foi gravado
      const existingEvent = await tx.trackingEvent.findUnique({
        where: { deduplicationKey },
      });

      if (existingEvent) {
        return { tracking, event: existingEvent, statusChanged: false };
      }

      // 3. Gravar TrackingEvent (append-only)
      const event = await tx.trackingEvent.create({
        data: {
          trackingId: tracking.id,
          eventCode: input.eventCode,
          status: input.status,
          title: input.title,
          description: input.description,
          countryId: input.countryId,
          region: input.region,
          city: input.city,
          latitude: input.latitude,
          longitude: input.longitude,
          hubId: input.hubId,
          carrierEventId: carrierEventId || null,
          deduplicationKey,
          source: input.source || TrackingEventSource.SYSTEM,
          eventAt: input.eventAt,
          metadataJson: input.metadataJson as any,
        },
      });

      // 4. Detecção de evento atrasado / fora de ordem com desempate determinístico (sem statusRank)
      const lastEventAt = tracking.lastEventAt;
      const isTerminal = this.terminalStates.has(tracking.currentStatus);

      let isDelayedEvent = false;
      if (lastEventAt) {
        if (input.eventAt.getTime() < lastEventAt.getTime()) {
          isDelayedEvent = true;
        } else if (input.eventAt.getTime() === lastEventAt.getTime()) {
          // Desempate determinístico por receivedAt e id quando o eventAt é estritamente igual
          const latestEvent = await tx.trackingEvent.findFirst({
            where: { trackingId: tracking.id, id: { not: event.id } },
            orderBy: [{ eventAt: 'desc' }, { receivedAt: 'desc' }, { createdAt: 'desc' }],
          });

          if (latestEvent) {
            const eventReceivedAt = event.receivedAt ? event.receivedAt.getTime() : Date.now();
            const latestReceivedAt = latestEvent.receivedAt ? latestEvent.receivedAt.getTime() : 0;

            if (eventReceivedAt < latestReceivedAt) {
              isDelayedEvent = true;
            } else if (eventReceivedAt === latestReceivedAt) {
              if (event.id.localeCompare(latestEvent.id) <= 0) {
                isDelayedEvent = true;
              }
            }
          }
        }
      }

      if (isDelayedEvent || isTerminal) {
        // Evento fora de ordem/atrasado gravado em TrackingEvent para histórico append-only, mas status atual mantido
        return { tracking, event, statusChanged: false };
      }

      if (lastEventAt && input.eventAt.getTime() === lastEventAt.getTime() && tracking.currentStatus === input.status) {
        return { tracking, event, statusChanged: false };
      }

      // 5. Validar transição explícita via matriz de estados
      const validNextStates = this.allowedTransitions[tracking.currentStatus] || [];
      if (tracking.currentStatus !== input.status && !validNextStates.includes(input.status)) {
        throw new ConflictException(
          `Transição de status logístico inválida de ${tracking.currentStatus} para ${input.status}.`,
        );
      }

      // 6. Atualizar status do Tracking
      const previousStatus = tracking.currentStatus;
      const updatedTracking = await tx.tracking.update({
        where: { id: tracking.id },
        data: {
          currentStatus: input.status,
          lastEventAt: input.eventAt,
          deliveredAt: input.status === TrackingStatus.DELIVERED ? input.eventAt : tracking.deliveredAt,
        },
      });

      // 7. Gravar TrackingStatusHistory
      await tx.trackingStatusHistory.create({
        data: {
          trackingId: tracking.id,
          previousStatus,
          newStatus: input.status,
          reason: input.title,
          changedById: input.changedById,
        },
      });

      // 8. Atualizar Shipment e Order atomicamente
      await this.syncShipmentAndOrder(tx, tracking.shipment, input.status, input.changedById);

      // 9. Gravar OutboxEvent
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Tracking',
          aggregateId: tracking.id,
          eventType: `tracking.${input.status.toLowerCase()}`,
          payloadJson: {
            trackingId: tracking.id,
            trackingNumber: tracking.trackingNumber,
            previousStatus,
            newStatus: input.status,
            eventAt: input.eventAt,
          },
        },
      });

      return { tracking: updatedTracking, event, statusChanged: true };
    };

    if (externalTx) {
      return executeInTx(externalTx);
    }
    return this.prisma.$transaction((tx) => executeInTx(tx));
  }

  /**
   * Sincroniza o status do Shipment e do Order com base no novo status do Tracking.
   */
  private async syncShipmentAndOrder(
    tx: any,
    shipment: any,
    trackingStatus: TrackingStatus,
    changedById?: string,
  ) {
    if (!shipment) return;

    const order = shipment.order;
    if (order && ['PENDING_PAYMENT', 'CANCELLED'].includes(order.status)) {
      // Impede avanço logístico de pedidos cancelados ou aguardando pagamento
      throw new ConflictException(
        `O pedido ${order.orderNumber} está com status ${order.status} e não pode avançar na logística.`,
      );
    }

    let newShipmentStatus: ShipmentStatus | null = null;
    let newOrderStatus: OrderStatus | null = null;

    switch (trackingStatus) {
      case TrackingStatus.PICKED_UP:
      case TrackingStatus.RECEIVED_AT_ORIGIN_HUB:
      case TrackingStatus.IN_TRANSIT:
        newShipmentStatus = ShipmentStatus.DISPATCHED;
        newOrderStatus = OrderStatus.SHIPPED;
        break;
      case TrackingStatus.OUT_FOR_DELIVERY:
        newShipmentStatus = ShipmentStatus.DISPATCHED;
        newOrderStatus = OrderStatus.OUT_FOR_DELIVERY;
        break;
      case TrackingStatus.DELIVERED:
        newShipmentStatus = ShipmentStatus.DISPATCHED;
        newOrderStatus = OrderStatus.DELIVERED;
        break;
      case TrackingStatus.RETURNED:
        newShipmentStatus = ShipmentStatus.CANCELLED;
        newOrderStatus = OrderStatus.RETURNED;
        break;
    }

    if (newShipmentStatus && shipment.status !== newShipmentStatus) {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: newShipmentStatus,
          dispatchedAt: newShipmentStatus === ShipmentStatus.DISPATCHED ? new Date() : shipment.dispatchedAt,
        },
      });

      await tx.shipmentHistory.create({
        data: {
          shipmentId: shipment.id,
          previousStatus: shipment.status,
          newStatus: newShipmentStatus,
          notes: `Status atualizado via rastreamento (${trackingStatus})`,
          changedById,
        },
      });
    }

    if (newOrderStatus && order && order.status !== newOrderStatus) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: newOrderStatus },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: order.status,
          newStatus: newOrderStatus,
          reason: `Atualização de rastreamento logístico: ${trackingStatus}`,
          changedById,
        },
      });
    }
  }
}
