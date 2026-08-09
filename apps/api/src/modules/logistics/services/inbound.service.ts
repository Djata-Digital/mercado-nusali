import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocationAllocationService } from './location-allocation.service';
import { CreateInboundShipmentDto, InspectInboundItemDto } from '../dto/inbound.dto';
import { InboundShipmentStatus, ReceivingInspectionStatus, MovementType } from '@prisma/client';

@Injectable()
export class InboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly allocationService: LocationAllocationService,
  ) {}

  async createShipment(dto: CreateInboundShipmentDto, userId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) {
      throw new NotFoundException(`HUB/Armazém ${dto.warehouseId} não encontrado.`);
    }

    const shipmentNumber = `INB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const shipment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inboundShipment.create({
        data: {
          shipmentNumber,
          warehouseId: dto.warehouseId,
          supplierName: dto.supplierName,
          supplierCode: dto.supplierCode,
          carrierName: dto.carrierName,
          trackingCode: dto.trackingCode,
          status: InboundShipmentStatus.CREATED,
          estimatedArrival: dto.estimatedArrival ? new Date(dto.estimatedArrival) : undefined,
          createdById: userId,
          items: {
            create: dto.items.map((item) => ({
              variantId: item.variantId,
              expectedQuantity: item.expectedQuantity,
              unitWeight: item.unitWeight || 0,
              unitVolume: item.unitVolume || 0,
            })),
          },
        },
        include: {
          items: {
            include: { variant: true },
          },
        },
      });

      await tx.receivingHistory.create({
        data: {
          shipmentId: created.id,
          previousStatus: null,
          newStatus: InboundShipmentStatus.CREATED,
          notes: 'Ordem de recebimento criada.',
          changedById: userId,
        },
      });

      return created;
    });

    return shipment;
  }

  async markInTransit(shipmentId: string, userId: string) {
    const shipment = await this.prisma.inboundShipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      throw new NotFoundException(`Recebimento ${shipmentId} não encontrado.`);
    }

    const updated = await this.prisma.inboundShipment.update({
      where: { id: shipmentId },
      data: { status: InboundShipmentStatus.IN_TRANSIT },
    });

    await this.prisma.receivingHistory.create({
      data: {
        shipmentId,
        previousStatus: shipment.status,
        newStatus: InboundShipmentStatus.IN_TRANSIT,
        notes: 'Carga em trânsito para o HUB.',
        changedById: userId,
      },
    });

    return updated;
  }

  async receiveShipment(shipmentId: string, userId: string) {
    const shipment = await this.prisma.inboundShipment.findUnique({
      where: { id: shipmentId },
      include: { items: true },
    });
    if (!shipment) {
      throw new NotFoundException(`Recebimento ${shipmentId} não encontrado.`);
    }

    const updated = await this.prisma.inboundShipment.update({
      where: { id: shipmentId },
      data: {
        status: InboundShipmentStatus.RECEIVED,
        receivedAt: new Date(),
      },
    });

    await this.prisma.receivingHistory.create({
      data: {
        shipmentId,
        previousStatus: shipment.status,
        newStatus: InboundShipmentStatus.RECEIVED,
        notes: 'Carga recebida na doca do HUB.',
        changedById: userId,
      },
    });

    this.eventEmitter.emit('shipment.received', {
      shipmentId: updated.id,
      shipmentNumber: updated.shipmentNumber,
      warehouseId: updated.warehouseId,
      receivedBy: userId,
    });

    return updated;
  }

  async inspectItem(shipmentId: string, dto: InspectInboundItemDto, userId: string) {
    const shipment = await this.prisma.inboundShipment.findUnique({
      where: { id: shipmentId },
      include: { items: true },
    });
    if (!shipment) {
      throw new NotFoundException(`Recebimento ${shipmentId} não encontrado.`);
    }

    const item = shipment.items.find((i) => i.id === dto.itemId);
    if (!item) {
      throw new NotFoundException(`Item ${dto.itemId} não faz parte deste recebimento.`);
    }

    const failed = dto.failedQuantity || Math.max(0, dto.inspectedQuantity - dto.passedQuantity);
    const inspectionStatus = dto.status || (failed > 0 ? ReceivingInspectionStatus.PARTIAL : ReceivingInspectionStatus.APPROVED);

    const result = await this.prisma.$transaction(async (tx) => {
      const inspection = await tx.receivingInspection.create({
        data: {
          shipmentId,
          itemId: dto.itemId,
          inspectorId: userId,
          status: inspectionStatus,
          inspectedQuantity: dto.inspectedQuantity,
          passedQuantity: dto.passedQuantity,
          failedQuantity: failed,
          weightRecorded: dto.weightRecorded,
          photosJson: dto.photos || [],
          notes: dto.notes,
          rejectionReason: dto.rejectionReason,
        },
      });

      await tx.inboundItem.update({
        where: { id: dto.itemId },
        data: {
          receivedQuantity: dto.inspectedQuantity,
          acceptedQuantity: dto.passedQuantity,
          rejectedQuantity: failed,
        },
      });

      await tx.inboundShipment.update({
        where: { id: shipmentId },
        data: { status: InboundShipmentStatus.INSPECTING },
      });

      await tx.receivingHistory.create({
        data: {
          shipmentId,
          previousStatus: shipment.status,
          newStatus: InboundShipmentStatus.INSPECTING,
          notes: `Item ${item.variantId} inspecionado: ${dto.passedQuantity} aprovados, ${failed} reprovados.`,
          changedById: userId,
        },
      });

      return inspection;
    });

    this.eventEmitter.emit('inspection.completed', {
      shipmentId,
      itemId: dto.itemId,
      passedQuantity: dto.passedQuantity,
      failedQuantity: failed,
      inspectorId: userId,
    });

    return result;
  }

  async storeShipment(shipmentId: string, userId: string) {
    const shipment = await this.prisma.inboundShipment.findUnique({
      where: { id: shipmentId },
      include: { items: true },
    });
    if (!shipment) {
      throw new NotFoundException(`Recebimento ${shipmentId} não encontrado.`);
    }

    if (shipment.status === InboundShipmentStatus.STORED) {
      throw new BadRequestException('Esta carga já foi armazenada no estoque.');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of shipment.items) {
        if (item.acceptedQuantity > 0) {
          // Automatic location allocation
          const totalWeight = Number(item.unitWeight || 0) * item.acceptedQuantity;
          const totalVolume = Number(item.unitVolume || 0) * item.acceptedQuantity;

          const location = await this.allocationService.findOptimalLocation({
            warehouseId: shipment.warehouseId,
            quantityNeeded: item.acceptedQuantity,
            totalWeightKg: totalWeight,
            totalVolumeM3: totalVolume,
          });

          await this.allocationService.allocateToLocation(
            location.id,
            item.acceptedQuantity,
            totalWeight,
            totalVolume,
            tx,
          );

          await tx.inboundItem.update({
            where: { id: item.id },
            data: { allocatedLocationId: location.id },
          });

          // Upsert InventoryItem in HUB
          const inventoryItem = await tx.inventoryItem.upsert({
            where: {
              variantId_warehouseId: {
                variantId: item.variantId,
                warehouseId: shipment.warehouseId,
              },
            },
            create: {
              variantId: item.variantId,
              warehouseId: shipment.warehouseId,
              quantityAvailable: item.acceptedQuantity,
            },
            update: {
              quantityAvailable: { increment: item.acceptedQuantity },
            },
          });

          // Record Inventory Movement
          await tx.inventoryMovement.create({
            data: {
              inventoryItemId: inventoryItem.id,
              type: MovementType.IN,
              quantity: item.acceptedQuantity,
              previousQuantity: inventoryItem.quantityAvailable - item.acceptedQuantity,
              newQuantity: inventoryItem.quantityAvailable,
              reason: `Recebimento da carga ${shipment.shipmentNumber}`,
              referenceType: 'INBOUND_SHIPMENT',
              referenceId: shipment.id,
              createdById: userId,
            },
          });

          this.eventEmitter.emit('inventory.allocated', {
            shipmentId,
            variantId: item.variantId,
            warehouseId: shipment.warehouseId,
            locationId: location.id,
            quantity: item.acceptedQuantity,
          });
        }
      }

      const updatedShipment = await tx.inboundShipment.update({
        where: { id: shipmentId },
        data: {
          status: InboundShipmentStatus.STORED,
          storedAt: new Date(),
        },
      });

      await tx.receivingHistory.create({
        data: {
          shipmentId,
          previousStatus: shipment.status,
          newStatus: InboundShipmentStatus.STORED,
          notes: 'Carga totalmente armazenada e disponível no estoque do HUB.',
          changedById: userId,
        },
      });

      return updatedShipment;
    });
  }

  async getShipmentById(shipmentId: string) {
    const shipment = await this.prisma.inboundShipment.findUnique({
      where: { id: shipmentId },
      include: {
        warehouse: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            variant: { include: { product: true } },
            allocatedLocation: true,
            inspections: true,
          },
        },
        history: {
          include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Recebimento ${shipmentId} não encontrado.`);
    }

    return shipment;
  }

  async listShipments(page = 1, limit = 20, warehouseId?: string, status?: InboundShipmentStatus) {
    const skip = (page - 1) * limit;
    const where = {
      ...(warehouseId && { warehouseId }),
      ...(status && { status }),
    };

    const [shipments, total] = await Promise.all([
      this.prisma.inboundShipment.findMany({
        where,
        skip,
        take: limit,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true, inspections: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inboundShipment.count({ where }),
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
}
