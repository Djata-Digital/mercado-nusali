import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShipmentDto, DispatchShipmentDto, CancelShipmentDto } from '../dto/shipping.dto';
import { ShipmentStatus, PackingOrderStatus, OrderStatus, ManifestStatus } from '@prisma/client';
import { recordOutboxEvent } from '../helpers/outbox.helper';
import { changeOrderStatusInTransaction } from '../helpers/order-status-history.helper';
import { validateHubAccess } from '../helpers/hub-authorization.helper';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Prisma real não cria ciclos quando relações são selecionadas em uma única direção,
   * mas mocks/test doubles e futuros adapters podem trazer a back-reference
   * shippingLabel.packingOrder. Nunca devolvemos essa back-reference pela API.
   */
  private sanitizeShipmentResponse(shipment: any): any {
    if (!shipment || typeof shipment !== 'object') return shipment;

    const packingOrder = shipment.packingOrder;
    const shippingLabel = packingOrder?.shippingLabel;

    if (!shippingLabel || typeof shippingLabel !== 'object') return shipment;

    const { packingOrder: _backReference, ...safeShippingLabel } = shippingLabel;

    return {
      ...shipment,
      packingOrder: {
        ...packingOrder,
        shippingLabel: safeShippingLabel,
      },
    };
  }


  async createShipment(dto: CreateShipmentDto, userId?: string, user?: any) {
    const packingOrder = await this.prisma.packingOrder.findUnique({
      where: { id: dto.packingOrderId },
      include: { order: true, shippingLabel: true },
    });

    if (!packingOrder) {
      throw new NotFoundException(`Ordem de Embalagem ${dto.packingOrderId} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, packingOrder.warehouseId);
    }

    if (packingOrder.status !== PackingOrderStatus.PACKED) {
      throw new BadRequestException(`A Ordem de Embalagem precisa estar PACKED para gerar envio. Status atual: ${packingOrder.status}`);
    }

    const shippingLabel = packingOrder.shippingLabel;

    if (!shippingLabel || shippingLabel.isInvalidated) {
      throw new BadRequestException(
        'Uma ShippingLabel válida precisa existir antes de criar o Shipment.',
      );
    }

    const existing = await this.prisma.shipment.findUnique({
      where: { packingOrderId: dto.packingOrderId },
    });
    if (existing) {
      return existing;
    }

    const shipmentCode = `SHP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const shipment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          shipmentCode,
          orderId: packingOrder.orderId,
          warehouseId: packingOrder.warehouseId,
          packingOrderId: dto.packingOrderId,
          status: ShipmentStatus.CREATED,
          notes: dto.notes,
        },
      });

      const trackingCode = shippingLabel.trackingNumber;

      await tx.shipmentPackage.create({
        data: {
          shipmentId: created.id,
          packingOrderId: dto.packingOrderId,
          trackingCode,
          weight: packingOrder.grossWeight || 0,
          dimensionsJson: {
            width: packingOrder.width ? Number(packingOrder.width) : 0,
            height: packingOrder.height ? Number(packingOrder.height) : 0,
            length: packingOrder.length ? Number(packingOrder.length) : 0,
          },
        },
      });

      await tx.shipmentHistory.create({
        data: {
          shipmentId: created.id,
          previousStatus: null,
          newStatus: ShipmentStatus.CREATED,
          notes: 'Registro de envio de expedição criado',
          changedById: userId || null,
        },
      });

      // Exigência 12: OrderStatusHistory no status READY_FOR_SHIPMENT
      await changeOrderStatusInTransaction(tx, packingOrder.orderId, OrderStatus.READY_FOR_SHIPMENT, 'Expedição gerada e pronta', userId);

      // Exigência 10 & 13: OutboxEvent (sem duplicação por EventEmitter)
      await recordOutboxEvent(tx, 'Shipment', created.id, 'shipment.created', {
        shipmentId: created.id,
        shipmentCode: created.shipmentCode,
        orderId: packingOrder.orderId,
        warehouseId: packingOrder.warehouseId,
        createdBy: userId,
      });

      return created;
    });

    return this.getShipmentById(shipment.id, user);
  }

  // Exigência 7: dispatchShipment (permitir somente READY_TO_SHIP ou WAITING_CARRIER; updateMany condicional; 409 em conflito; impedir CREATED -> DISPATCHED)
  async dispatchShipment(shipmentId: string, dto?: DispatchShipmentDto, userId?: string, user?: any) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      throw new NotFoundException(`Envio/Shipment ${shipmentId} não encontrado.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, shipment.warehouseId);
    }

    if (shipment.status === ShipmentStatus.DISPATCHED) {
      return shipment; // Idempotência para re-envio do mesmo estado
    }

    if (shipment.status === ShipmentStatus.CREATED) {
      throw new BadRequestException(
        'Envio no status CREATED não pode ser despachado diretamente. Adicione o envio a um romaneio (Manifest) ou mova para READY_TO_SHIP.',
      );
    }

    if (shipment.status !== ShipmentStatus.READY_TO_SHIP && shipment.status !== ShipmentStatus.WAITING_CARRIER) {
      throw new BadRequestException(`Despacho não permitido para envio no status ${shipment.status}.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const lockRes = await tx.shipment.updateMany({
        where: {
          id: shipmentId,
          status: { in: [ShipmentStatus.READY_TO_SHIP, ShipmentStatus.WAITING_CARRIER] },
        },
        data: {
          status: ShipmentStatus.DISPATCHED,
          dispatchedAt: new Date(),
          notes: dto?.notes || shipment.notes,
        },
      });

      if (lockRes.count === 0) {
        throw new ConflictException('Conflito no despacho: o envio já foi despachado ou teve seu status alterado concorrentemente.');
      }

      await tx.shipmentHistory.create({
        data: {
          shipmentId,
          previousStatus: shipment.status,
          newStatus: ShipmentStatus.DISPATCHED,
          notes: dto?.notes || 'Pacote despachado para a transportadora',
          changedById: userId || null,
        },
      });

      // Exigência 12: OrderStatusHistory no status SHIPPED
      await changeOrderStatusInTransaction(tx, shipment.orderId, OrderStatus.SHIPPED, 'Pacote despachado', userId);

      // Exigência 10 & 13: OutboxEvent
      await recordOutboxEvent(tx, 'Shipment', shipmentId, 'shipment.dispatched', {
        shipmentId,
        shipmentCode: shipment.shipmentCode,
        orderId: shipment.orderId,
        dispatchedBy: userId,
      });

      return tx.shipment.findUnique({ where: { id: shipmentId } });
    });

    return updated;
  }

  // Exigência 8: cancelShipment (definir estados canceláveis, impedir se em manifest CLOSED/DISPATCHED, exigir motivo)
  async cancelShipment(shipmentId: string, dto: CancelShipmentDto, userId?: string, user?: any) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { manifest: true },
    });
    if (!shipment) {
      throw new NotFoundException(`Envio/Shipment ${shipmentId} não encontrado.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, shipment.warehouseId);
    }

    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('Motivo do cancelamento da expedição é obrigatório.');
    }

    if (shipment.status === ShipmentStatus.DISPATCHED) {
      throw new BadRequestException('Não é possível cancelar uma expedição que já foi despachada para a transportadora.');
    }

    // Impedir cancelamento se estiver associado a um romaneio FECHADO ou DESPACHADO
    if (shipment.manifest) {
      if (shipment.manifest.status === ManifestStatus.CLOSED || shipment.manifest.status === ManifestStatus.DISPATCHED) {
        throw new BadRequestException(
          `Não é possível cancelar o envio pois ele pertence a um romaneio ${shipment.manifest.status}.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.CANCELLED,
          notes: dto.reason,
        },
      });

      await tx.shipmentHistory.create({
        data: {
          shipmentId,
          previousStatus: shipment.status,
          newStatus: ShipmentStatus.CANCELLED,
          notes: `Envio cancelado. Motivo: ${dto.reason}`,
          changedById: userId || null,
        },
      });

      return cancelled;
    });

    return updated;
  }

  // Exigência 9: reopenShipment (permitir somente de CANCELLED; exigir motivo; impedir se manifest existir ou houver despacho; transacional)
  async reopenShipment(shipmentId: string, reason?: string, userId?: string, user?: any) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { manifest: true },
    });
    if (!shipment) {
      throw new NotFoundException(`Envio/Shipment ${shipmentId} não encontrado.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, shipment.warehouseId);
    }

    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Motivo para reabertura da expedição é obrigatório.');
    }

    if (shipment.status !== ShipmentStatus.CANCELLED) {
      throw new BadRequestException(`Apenas expedições no status CANCELLED podem ser reabertas. Status atual: ${shipment.status}`);
    }

    if (shipment.manifestId || shipment.dispatchedAt) {
      throw new BadRequestException('Não é possível reabrir uma expedição associada a um romaneio ou já despachada.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const reopened = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.READY_TO_SHIP,
          dispatchedAt: null,
        },
      });

      await tx.shipmentHistory.create({
        data: {
          shipmentId,
          previousStatus: shipment.status,
          newStatus: ShipmentStatus.READY_TO_SHIP,
          notes: `Envio reaberto para expedição. Motivo: ${reason}`,
          changedById: userId || null,
        },
      });

      return reopened;
    });

    return updated;
  }

  async listShipments(page = 1, limit = 20, warehouseId?: string, status?: ShipmentStatus, user?: any) {
    const allowedWarehouses = user ? await validateHubAccess(this.prisma, user, warehouseId) : null;
    const skip = (page - 1) * limit;

    const where = {
      ...(warehouseId && { warehouseId }),
      ...(allowedWarehouses && { warehouseId: { in: allowedWarehouses } }),
      ...(status && { status }),
    };

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        include: {
          order: { select: { id: true, orderNumber: true } },
          packingOrder: { select: { id: true, packingNumber: true, grossWeight: true } },
          manifest: { select: { id: true, manifestNumber: true, status: true } },
          packages: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      data: shipments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getShipmentById(id: string, user?: any) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        order: true,
        warehouse: true,
        packingOrder: {
          include: {
            shippingLabel: true,
            material: true,
          },
        },
        manifest: true,
        packages: true,
        history: {
          include: {
            changedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Envio ${id} não encontrado.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, shipment.warehouseId);
    }

    return this.sanitizeShipmentResponse(shipment);
  }
}
