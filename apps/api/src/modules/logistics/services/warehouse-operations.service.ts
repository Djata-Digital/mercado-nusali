import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocationAllocationService } from './location-allocation.service';
import { CreateWarehouseMovementDto } from '../dto/movement.dto';
import { CreateCycleCountDto, SubmitCycleCountDto } from '../dto/cycle-count.dto';
import { CycleCountStatus, MovementType } from '@prisma/client';

@Injectable()
export class WarehouseOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly allocationService: LocationAllocationService,
  ) {}

  // ==========================================
  // 1. MOVIMENTAÇÃO INTERNA
  // ==========================================
  async createMovement(dto: CreateWarehouseMovementDto, userId: string) {
    if (dto.sourceLocationId && dto.sourceLocationId === dto.destinationLocationId) {
      throw new BadRequestException('A posição de origem e destino devem ser diferentes.');
    }

    return this.prisma.$transaction(async (tx) => {
      // If source location is provided, deallocate
      if (dto.sourceLocationId) {
        await this.allocationService.deallocateFromLocation(dto.sourceLocationId, dto.quantity, 0, 0, tx);
      }

      // If destination location is provided, allocate
      if (dto.destinationLocationId) {
        await this.allocationService.allocateToLocation(dto.destinationLocationId, dto.quantity, 0, 0, tx);
      }

      const movement = await tx.warehouseMovement.create({
        data: {
          warehouseId: dto.warehouseId,
          variantId: dto.variantId,
          sourceLocationId: dto.sourceLocationId,
          destinationLocationId: dto.destinationLocationId,
          quantity: dto.quantity,
          reason: dto.reason || 'Movimentação física de reestruturação interna',
          movedById: userId,
        },
      });

      return movement;
    });
  }

  async listMovements(page = 1, limit = 20, warehouseId?: string, variantId?: string) {
    const skip = (page - 1) * limit;
    const where = {
      ...(warehouseId && { warehouseId }),
      ...(variantId && { variantId }),
    };

    const [movements, total] = await Promise.all([
      this.prisma.warehouseMovement.findMany({
        where,
        skip,
        take: limit,
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          variant: { select: { id: true, sku: true, name: true } },
          sourceLocation: { select: { id: true, code: true } },
          destinationLocation: { select: { id: true, code: true } },
          movedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.warehouseMovement.count({ where }),
    ]);

    return {
      data: movements,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // 2. INVENTÁRIO CÍCLICO
  // ==========================================
  async createCycleCount(dto: CreateCycleCountDto, userId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException(`HUB ${dto.warehouseId} não encontrado.`);

    const countNumber = `CNT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return this.prisma.cycleCount.create({
      data: {
        countNumber,
        warehouseId: dto.warehouseId,
        zoneId: dto.zoneId,
        status: CycleCountStatus.PLANNED,
        assignedAuditorId: dto.assignedAuditorId || userId,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : new Date(),
      },
    });
  }

  async startCycleCount(countId: string) {
    const cycleCount = await this.prisma.cycleCount.findUnique({
      where: { id: countId },
    });

    if (!cycleCount) throw new NotFoundException(`Inventário cíclico ${countId} não encontrado.`);
    if (cycleCount.status !== CycleCountStatus.PLANNED) {
      throw new BadRequestException(`Inventário cíclico em status ${cycleCount.status} não pode ser iniciado.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Find locations in warehouse/zone
      const locations = await tx.hubLocation.findMany({
        where: {
          warehouseId: cycleCount.warehouseId,
          ...(cycleCount.zoneId && { zoneId: cycleCount.zoneId }),
        },
      });

      // Find inventory items in warehouse
      const inventoryItems = await tx.inventoryItem.findMany({
        where: { warehouseId: cycleCount.warehouseId },
      });

      // Populate cycle count items
      if (locations.length > 0 && inventoryItems.length > 0) {
        for (const loc of locations) {
          for (const inv of inventoryItems) {
            await tx.cycleCountItem.create({
              data: {
                cycleCountId: countId,
                variantId: inv.variantId,
                locationId: loc.id,
                systemQuantity: inv.quantityAvailable,
              },
            });
          }
        }
      }

      return tx.cycleCount.update({
        where: { id: countId },
        data: { status: CycleCountStatus.IN_PROGRESS },
      });
    });
  }

  async submitCounts(countId: string, dto: SubmitCycleCountDto) {
    const cycleCount = await this.prisma.cycleCount.findUnique({
      where: { id: countId },
      include: { items: true },
    });

    if (!cycleCount) throw new NotFoundException(`Inventário cíclico ${countId} não encontrado.`);

    return this.prisma.$transaction(async (tx) => {
      for (const inputItem of dto.items) {
        const item = cycleCount.items.find((i) => i.id === inputItem.itemId);
        if (item) {
          const counted = inputItem.recountQuantity !== undefined ? inputItem.recountQuantity : inputItem.countedQuantity;
          const diff = counted - item.systemQuantity;

          await tx.cycleCountItem.update({
            where: { id: item.id },
            data: {
              countedQuantity: inputItem.countedQuantity,
              recountQuantity: inputItem.recountQuantity,
              differenceQuantity: diff,
              notes: inputItem.notes,
            },
          });
        }
      }

      return tx.cycleCount.update({
        where: { id: countId },
        data: { status: CycleCountStatus.UNDER_REVIEW },
      });
    });
  }

  async reconcileAndAdjust(countId: string, userId: string) {
    const cycleCount = await this.prisma.cycleCount.findUnique({
      where: { id: countId },
      include: { items: true },
    });

    if (!cycleCount) throw new NotFoundException(`Inventário cíclico ${countId} não encontrado.`);

    return this.prisma.$transaction(async (tx) => {
      let totalAdjustments = 0;

      for (const item of cycleCount.items) {
        if (item.countedQuantity !== null && item.differenceQuantity !== null && item.differenceQuantity !== 0 && !item.adjustmentApplied) {
          const inv = await tx.inventoryItem.findUnique({
            where: {
              variantId_warehouseId: {
                variantId: item.variantId,
                warehouseId: cycleCount.warehouseId,
              },
            },
          });

          if (inv) {
            const previousQty = inv.quantityAvailable;
            const newQty = Math.max(0, previousQty + item.differenceQuantity);

            await tx.inventoryItem.update({
              where: { id: inv.id },
              data: { quantityAvailable: newQty },
            });

            await tx.inventoryMovement.create({
              data: {
                inventoryItemId: inv.id,
                type: MovementType.ADJUSTMENT,
                quantity: item.differenceQuantity,
                previousQuantity: previousQty,
                newQuantity: newQty,
                reason: `Conciliação de inventário cíclico ${cycleCount.countNumber}`,
                referenceType: 'CYCLE_COUNT',
                referenceId: cycleCount.id,
                createdById: userId,
              },
            });

            await tx.cycleCountItem.update({
              where: { id: item.id },
              data: { adjustmentApplied: true },
            });

            totalAdjustments++;
          }
        }
      }

      const updated = await tx.cycleCount.update({
        where: { id: countId },
        data: {
          status: CycleCountStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      this.eventEmitter.emit('cyclecount.finished', {
        cycleCountId: updated.id,
        countNumber: updated.countNumber,
        warehouseId: updated.warehouseId,
        totalAdjustments,
        finishedBy: userId,
      });

      return updated;
    });
  }

  async getCycleCountById(countId: string) {
    const count = await this.prisma.cycleCount.findUnique({
      where: { id: countId },
      include: {
        warehouse: true,
        zone: true,
        assignedAuditor: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            variant: { include: { product: true } },
            location: true,
          },
        },
      },
    });

    if (!count) throw new NotFoundException(`Inventário cíclico ${countId} não encontrado.`);
    return count;
  }
}
