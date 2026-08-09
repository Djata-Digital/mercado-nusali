import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateShippingManifestDto, CloseManifestDto } from '../dto/manifest.dto';
import { ManifestStatus, ShipmentStatus, OrderStatus } from '@prisma/client';
import { recordOutboxEvent } from '../helpers/outbox.helper';
import { changeOrderStatusInTransaction } from '../helpers/order-status-history.helper';
import { validateHubAccess } from '../helpers/hub-authorization.helper';

@Injectable()
export class ManifestService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeManifestResponse(manifest: any): any {
    if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.items)) {
      return manifest;
    }

    return {
      ...manifest,
      items: manifest.items.map((item: any) => {
        const shipment = item?.shipment;
        const packingOrder = shipment?.packingOrder;
        const shippingLabel = packingOrder?.shippingLabel;

        if (!shippingLabel || typeof shippingLabel !== 'object') return item;

        const { packingOrder: _backReference, ...safeShippingLabel } = shippingLabel;

        return {
          ...item,
          shipment: {
            ...shipment,
            packingOrder: {
              ...packingOrder,
              shippingLabel: safeShippingLabel,
            },
          },
        };
      }),
    };
  }


  async createManifest(dto: CreateShippingManifestDto, userId?: string, user?: any) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) {
      throw new NotFoundException(`Armazém/HUB ${dto.warehouseId} não encontrado.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, dto.warehouseId);
    }

    const carrierName = dto.carrierName?.trim();
    if (!carrierName) {
      throw new BadRequestException('Nome real da transportadora (carrierName) é obrigatório no romaneio.');
    }

    if (!dto.shipmentIds || dto.shipmentIds.length === 0) {
      throw new BadRequestException('Informe ao menos um envio (Shipment) para criar o romaneio.');
    }

    const shipments = await this.prisma.shipment.findMany({
      where: { id: { in: dto.shipmentIds } },
      include: { packingOrder: true },
    });

    if (shipments.length !== dto.shipmentIds.length) {
      throw new BadRequestException('Um ou mais IDs de expedição/shipment não foram encontrados.');
    }

    for (const ship of shipments) {
      if (ship.warehouseId !== dto.warehouseId) {
        throw new BadRequestException(`O envio ${ship.shipmentCode} pertence a outro armazém (${ship.warehouseId}).`);
      }

      if (ship.manifestId) {
        throw new BadRequestException(`O envio ${ship.shipmentCode} já está associado a outro romaneio (${ship.manifestId}).`);
      }

      if (ship.status !== ShipmentStatus.CREATED && ship.status !== ShipmentStatus.READY_TO_SHIP) {
        throw new BadRequestException(`O envio ${ship.shipmentCode} não está em status permitido para romaneio (status atual: ${ship.status}).`);
      }
    }

    const manifestNumber = `MNF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalWeight = 0;
    for (const ship of shipments) {
      if (ship.packingOrder && ship.packingOrder.grossWeight) {
        totalWeight += Number(ship.packingOrder.grossWeight);
      }
    }

    const manifest = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shippingManifest.create({
        data: {
          manifestNumber,
          warehouseId: dto.warehouseId,
          status: ManifestStatus.CREATED,
          driverName: dto.driverName,
          driverDocument: dto.driverDocument,
          vehiclePlate: dto.vehiclePlate,
          carrierName,
          totalPackages: shipments.length,
          totalWeight,
          createdById: userId || null,
          notes: dto.notes,
        },
      });

      for (const ship of shipments) {
        await tx.shippingManifestItem.create({
          data: {
            manifestId: created.id,
            shipmentId: ship.id,
          },
        });

        await tx.shipment.update({
          where: { id: ship.id },
          data: {
            manifestId: created.id,
            status: ShipmentStatus.READY_TO_SHIP,
          },
        });
      }

      // Exigência 10 & 13: OutboxEvent (sem EventEmitter duplicado)
      await recordOutboxEvent(tx, 'ShippingManifest', created.id, 'manifest.created', {
        manifestId: created.id,
        manifestNumber: created.manifestNumber,
        warehouseId: dto.warehouseId,
        totalPackages: shipments.length,
        createdBy: userId,
      });

      return created;
    });

    return this.getManifestById(manifest.id, user);
  }

  async closeManifest(manifestId: string, dto?: CloseManifestDto, userId?: string, user?: any) {
    const manifest = await this.prisma.shippingManifest.findUnique({ where: { id: manifestId } });
    if (!manifest) {
      throw new NotFoundException(`Romaneio ${manifestId} não encontrado.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, manifest.warehouseId);
    }

    if (manifest.status !== ManifestStatus.CREATED) {
      throw new BadRequestException(`Romaneio não pode ser fechado a partir do status ${manifest.status}. Somente romaneios em CREATED podem ser fechados.`);
    }

    const updated = await this.prisma.shippingManifest.update({
      where: { id: manifestId },
      data: {
        status: ManifestStatus.CLOSED,
        notes: dto?.notes || manifest.notes,
      },
    });

    return this.sanitizeManifestResponse(updated);
  }

  async dispatchManifest(manifestId: string, userId?: string, user?: any) {
    const manifest = await this.prisma.shippingManifest.findUnique({
      where: { id: manifestId },
      include: { items: { include: { shipment: true } } },
    });
    if (!manifest) {
      throw new NotFoundException(`Romaneio ${manifestId} não encontrado.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, manifest.warehouseId);
    }

    if (manifest.status === ManifestStatus.DISPATCHED) {
      return this.sanitizeManifestResponse(manifest);
    }

    if (manifest.status !== ManifestStatus.CLOSED) {
      throw new BadRequestException(`O romaneio precisa estar no status FECHADO (CLOSED) antes de ser despachado. Status atual: ${manifest.status}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateRes = await tx.shippingManifest.updateMany({
        where: { id: manifestId, status: ManifestStatus.CLOSED },
        data: {
          status: ManifestStatus.DISPATCHED,
          dispatchedAt: new Date(),
        },
      });

      if (updateRes.count === 0) {
        throw new ConflictException('O romaneio foi modificado ou despachado concorrentemente.');
      }

      for (const item of manifest.items) {
        await tx.shipment.update({
          where: { id: item.shipmentId },
          data: {
            status: ShipmentStatus.DISPATCHED,
            dispatchedAt: new Date(),
          },
        });

        await tx.shipmentHistory.create({
          data: {
            shipmentId: item.shipmentId,
            previousStatus: item.shipment.status,
            newStatus: ShipmentStatus.DISPATCHED,
            notes: `Expedido através do Romaneio ${manifest.manifestNumber}`,
            changedById: userId || null,
          },
        });

        await changeOrderStatusInTransaction(tx, item.shipment.orderId, OrderStatus.SHIPPED, `Despachado via Romaneio ${manifest.manifestNumber}`, userId);
      }

      // Exigência 10 & 13: OutboxEvent
      await recordOutboxEvent(tx, 'ShippingManifest', manifestId, 'shipment.dispatched', {
        manifestId,
        manifestNumber: manifest.manifestNumber,
        shipmentCount: manifest.items.length,
        dispatchedBy: userId,
      });

      return tx.shippingManifest.findUnique({ where: { id: manifestId } });
    });

    return this.sanitizeManifestResponse(updated);
  }

  async listManifests(page = 1, limit = 20, warehouseId?: string, status?: ManifestStatus, user?: any) {
    const allowedWarehouses = user ? await validateHubAccess(this.prisma, user, warehouseId) : null;
    const skip = (page - 1) * limit;

    const where = {
      ...(warehouseId && { warehouseId }),
      ...(allowedWarehouses && { warehouseId: { in: allowedWarehouses } }),
      ...(status && { status }),
    };

    const [manifests, total] = await Promise.all([
      this.prisma.shippingManifest.findMany({
        where,
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shippingManifest.count({ where }),
    ]);

    return {
      data: manifests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getManifestById(id: string, user?: any) {
    const manifest = await this.prisma.shippingManifest.findUnique({
      where: { id },
      include: {
        warehouse: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            shipment: {
              include: {
                order: true,
                packingOrder: { include: { shippingLabel: true } },
              },
            },
          },
        },
      },
    });

    if (!manifest) {
      throw new NotFoundException(`Romaneio ${id} não encontrado.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, manifest.warehouseId);
    }

    return this.sanitizeManifestResponse(manifest);
  }
}
