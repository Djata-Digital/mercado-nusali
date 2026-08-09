import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePackingMaterialDto,
  StartPackingDto,
  CompletePackingDto,
  CancelPackingOrderDto,
} from '../dto/packing.dto';
import { PackingOrderStatus, PickingOrderStatus, PackingMaterialType, PackingMaterialStatus, ShipmentStatus } from '@prisma/client';
import { recordOutboxEvent } from '../helpers/outbox.helper';
import { validateHubAccess } from '../helpers/hub-authorization.helper';

export class ReopenPackingDto {
  reason!: string;
}

@Injectable()
export class PackingService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------
  // CATÁLOGO DE EMBALAGENS (PackingMaterial)
  // -------------------------------------------------------------

  async createMaterial(dto: CreatePackingMaterialDto) {
    const existing = await this.prisma.packingMaterial.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Já existe uma embalagem com o código ${dto.code}.`);
    }

    const volume = (dto.width * dto.height * dto.length) / 1000000;

    return this.prisma.packingMaterial.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        ownWeight: dto.ownWeight,
        maxWeight: dto.maxWeight,
        width: dto.width,
        height: dto.height,
        length: dto.length,
        volume,
        stockQuantity: dto.stockQuantity || 1000,
        status: PackingMaterialStatus.ACTIVE,
      },
    });
  }

  async listMaterials(type?: PackingMaterialType, status?: PackingMaterialStatus) {
    const where = {
      ...(type && { type }),
      ...(status && { status }),
    };

    return this.prisma.packingMaterial.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  // -------------------------------------------------------------
  // FLUXO DE ORDEM DE EMBALAGEM (PackingOrder)
  // -------------------------------------------------------------

  async startPacking(dto: StartPackingDto, userId?: string, user?: any) {
    const pickingOrder = await this.prisma.pickingOrder.findUnique({
      where: { id: dto.pickingOrderId },
      include: { items: true },
    });
    if (!pickingOrder) {
      throw new NotFoundException(`Ordem de Picking ${dto.pickingOrderId} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, pickingOrder.warehouseId);
    }

    if (pickingOrder.status !== PickingOrderStatus.PICKED) {
      throw new BadRequestException(`A Ordem de Picking precisa estar no status PICKED para iniciar a embalagem. Status atual: ${pickingOrder.status}`);
    }

    const existing = await this.prisma.packingOrder.findUnique({
      where: { pickingOrderId: dto.pickingOrderId },
    });
    if (existing) {
      return existing;
    }

    const packingNumber = `PAK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const packingOrder = await this.prisma.$transaction(async (tx) => {
      const created = await tx.packingOrder.create({
        data: {
          packingNumber,
          pickingOrderId: dto.pickingOrderId,
          orderId: pickingOrder.orderId,
          warehouseId: pickingOrder.warehouseId,
          status: PackingOrderStatus.IN_PROGRESS,
          operatorId: userId || null,
          startedAt: new Date(),
        },
      });

      for (const item of pickingOrder.items) {
        if (item.pickedQuantity > 0) {
          await tx.packingItem.create({
            data: {
              packingOrderId: created.id,
              variantId: item.variantId,
              quantity: item.pickedQuantity,
            },
          });
        }
      }

      await tx.packingHistory.create({
        data: {
          packingOrderId: created.id,
          previousStatus: null,
          newStatus: PackingOrderStatus.IN_PROGRESS,
          notes: 'Processo de embalagem iniciado na bancada',
          changedById: userId || null,
        },
      });

      return created;
    });

    return this.getPackingOrderById(packingOrder.id, user);
  }

  async completePacking(id: string, dto: CompletePackingDto, userId?: string, user?: any) {
    const packingOrder = await this.prisma.packingOrder.findUnique({
      where: { id },
      include: { material: true },
    });
    if (!packingOrder) {
      throw new NotFoundException(`Ordem de Embalagem ${id} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, packingOrder.warehouseId);
    }

    if (packingOrder.status !== PackingOrderStatus.IN_PROGRESS) {
      throw new BadRequestException(`A Ordem de Embalagem precisa estar no status IN_PROGRESS para ser concluída (status atual: ${packingOrder.status}).`);
    }

    const volumetricWeight = (dto.width * dto.height * dto.length) / 5000;
    const selectedMaterialId = dto.materialId || packingOrder.materialId;

    const updated = await this.prisma.$transaction(async (tx) => {
      let ownWeight = 0;

      if (selectedMaterialId) {
        const updatedMaterial = await tx.packingMaterial.updateMany({
          where: { id: selectedMaterialId, stockQuantity: { gte: 1 } },
          data: { stockQuantity: { decrement: 1 } },
        });

        if (updatedMaterial.count === 0) {
          throw new BadRequestException('Estoque da embalagem selecionada está esgotado.');
        }

        const mat = await tx.packingMaterial.findUnique({ where: { id: selectedMaterialId } });
        if (mat) ownWeight = Number(mat.ownWeight);
      }

      const netWeight = Math.max(0, dto.grossWeight - ownWeight);

      const packedOrder = await tx.packingOrder.update({
        where: { id },
        data: {
          materialId: selectedMaterialId,
          grossWeight: dto.grossWeight,
          netWeight,
          width: dto.width,
          height: dto.height,
          length: dto.length,
          volumetricWeight,
          sealCode: dto.sealCode,
          notes: dto.notes,
          status: PackingOrderStatus.PACKED,
          completedAt: new Date(),
          operatorId: userId || packingOrder.operatorId || null,
        },
      });

      await tx.packingHistory.create({
        data: {
          packingOrderId: id,
          previousStatus: PackingOrderStatus.IN_PROGRESS,
          newStatus: PackingOrderStatus.PACKED,
          notes: `Embalagem concluída com sucesso. Peso bruto: ${dto.grossWeight}KG, Volumétrico: ${volumetricWeight.toFixed(2)}KG`,
          changedById: userId || null,
        },
      });

      // Exigência 10 & 13: Gravação exclusivamente no OutboxEvent
      await recordOutboxEvent(tx, 'PackingOrder', id, 'packing.completed', {
        packingOrderId: id,
        packingNumber: packedOrder.packingNumber,
        orderId: packedOrder.orderId,
        grossWeight: dto.grossWeight,
        volumetricWeight,
        completedBy: userId,
      });

      return packedOrder;
    });

    return this.getPackingOrderById(id, user);
  }

  // Exigência 6: cancelPacking transacional (motivo, bloqueio após shipment, devolução de material, invalidação de etiqueta)
  async cancelPacking(id: string, dto: CancelPackingOrderDto, userId?: string, user?: any) {
    const packingOrder = await this.prisma.packingOrder.findUnique({
      where: { id },
      include: { shipment: true, shippingLabel: true },
    });
    if (!packingOrder) {
      throw new NotFoundException(`Ordem de Embalagem ${id} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, packingOrder.warehouseId);
    }

    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('Motivo do cancelamento da embalagem é obrigatório.');
    }

    // Impedir cancelamento se já existir envio (Shipment)
    if (packingOrder.shipment) {
      throw new BadRequestException('Não é possível cancelar uma Ordem de Embalagem que já possui envio (Shipment) associado.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Devolver material se embalagem já havia sido concluída
      if (packingOrder.materialId && packingOrder.status === PackingOrderStatus.PACKED) {
        await tx.packingMaterial.update({
          where: { id: packingOrder.materialId },
          data: { stockQuantity: { increment: 1 } },
        });
      }

      // Invalidar etiqueta de envio se gerada
      if (packingOrder.shippingLabel) {
        await tx.shippingLabel.update({
          where: { id: packingOrder.shippingLabel.id },
          data: {
            isInvalidated: true,
            invalidatedAt: new Date(),
            invalidationReason: dto.reason,
          },
        });

        await tx.shippingLabelHistory.create({
          data: {
            shippingLabelId: packingOrder.shippingLabel.id,
            action: 'INVALIDATED',
            printedById: userId || null,
            reprintReason: `Invalidada por cancelamento de embalagem: ${dto.reason}`,
          },
        });
      }

      const cancelledOrder = await tx.packingOrder.update({
        where: { id },
        data: {
          status: PackingOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
        },
      });

      await tx.packingHistory.create({
        data: {
          packingOrderId: id,
          previousStatus: packingOrder.status,
          newStatus: PackingOrderStatus.CANCELLED,
          notes: `Embalagem cancelada. Motivo: ${dto.reason}`,
          changedById: userId || null,
        },
      });

      return cancelledOrder;
    });

    return updated;
  }

  async reopenPacking(id: string, reason: string, userId?: string, user?: any) {
    const packingOrder = await this.prisma.packingOrder.findUnique({
      where: { id },
      include: { shipment: true, shippingLabel: true },
    });
    if (!packingOrder) {
      throw new NotFoundException(`Ordem de Embalagem ${id} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, packingOrder.warehouseId);
    }

    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Informe obrigatoriamente o motivo da reabertura da embalagem.');
    }

    if (packingOrder.shipment && packingOrder.shipment.status === ShipmentStatus.DISPATCHED) {
      throw new BadRequestException('Não é possível reabrir a embalagem de um envio que já foi despachado para a transportadora.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (packingOrder.materialId && packingOrder.status === PackingOrderStatus.PACKED) {
        await tx.packingMaterial.update({
          where: { id: packingOrder.materialId },
          data: { stockQuantity: { increment: 1 } },
        });
      }

      if (packingOrder.shippingLabel) {
        await tx.shippingLabel.update({
          where: { id: packingOrder.shippingLabel.id },
          data: {
            isInvalidated: true,
            invalidatedAt: new Date(),
            invalidationReason: reason,
          },
        });

        await tx.shippingLabelHistory.create({
          data: {
            shippingLabelId: packingOrder.shippingLabel.id,
            action: 'INVALIDATED',
            printedById: userId || null,
            reprintReason: `Invalidada devido à reabertura da embalagem: ${reason}`,
          },
        });
      }

      const reopened = await tx.packingOrder.update({
        where: { id },
        data: {
          status: PackingOrderStatus.IN_PROGRESS,
          completedAt: null,
          cancelledAt: null,
          cancellationReason: null,
        },
      });

      await tx.packingHistory.create({
        data: {
          packingOrderId: id,
          previousStatus: packingOrder.status,
          newStatus: PackingOrderStatus.IN_PROGRESS,
          notes: `Ordem de Embalagem reaberta. Motivo: ${reason}`,
          changedById: userId || null,
        },
      });

      return reopened;
    });

    return updated;
  }

  async listPackingOrders(page = 1, limit = 20, warehouseId?: string, status?: PackingOrderStatus, user?: any) {
    const allowedWarehouses = user ? await validateHubAccess(this.prisma, user, warehouseId) : null;
    const skip = (page - 1) * limit;

    const where = {
      ...(warehouseId && { warehouseId }),
      ...(allowedWarehouses && { warehouseId: { in: allowedWarehouses } }),
      ...(status && { status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.packingOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          order: { select: { id: true, orderNumber: true } },
          material: true,
          operator: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.packingOrder.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPackingOrderById(id: string, user?: any) {
    const packingOrder = await this.prisma.packingOrder.findUnique({
      where: { id },
      include: {
        pickingOrder: true,
        order: true,
        warehouse: true,
        material: true,
        operator: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
        shippingLabel: true,
        history: {
          include: {
            changedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!packingOrder) {
      throw new NotFoundException(`Ordem de Embalagem ${id} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, packingOrder.warehouseId);
    }

    return packingOrder;
  }
}
