import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LocationAllocationService } from './location-allocation.service';
import { CreateTransferOrderDto } from '../dto/transfer.dto';
import { TransferOrderStatus, MovementType } from '@prisma/client';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly allocationService: LocationAllocationService,
  ) {}

  async createTransfer(dto: CreateTransferOrderDto, userId: string) {
    if (dto.originWarehouseId === dto.destinationWarehouseId) {
      throw new BadRequestException('O HUB de origem e destino devem ser diferentes.');
    }

    const [originHub, destHub] = await Promise.all([
      this.prisma.warehouse.findUnique({ where: { id: dto.originWarehouseId } }),
      this.prisma.warehouse.findUnique({ where: { id: dto.destinationWarehouseId } }),
    ]);

    if (!originHub) throw new NotFoundException(`HUB de origem ${dto.originWarehouseId} não encontrado.`);
    if (!destHub) throw new NotFoundException(`HUB de destino ${dto.destinationWarehouseId} não encontrado.`);

    const transferNumber = `TRF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transfer = await this.prisma.$transaction(async (tx) => {
      // Validate availability at origin hub
      for (const item of dto.items) {
        const inv = await tx.inventoryItem.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: dto.originWarehouseId,
            },
          },
        });

        if (!inv || inv.quantityAvailable < item.quantity) {
          throw new BadRequestException(
            `Estoque insuficiente da variante ${item.variantId} no HUB de origem ${originHub.code}. (Disponível: ${inv?.quantityAvailable || 0}, Solicitado: ${item.quantity})`,
          );
        }
      }

      const created = await tx.transferOrder.create({
        data: {
          transferNumber,
          originWarehouseId: dto.originWarehouseId,
          destinationWarehouseId: dto.destinationWarehouseId,
          status: TransferOrderStatus.REQUESTED,
          requestedById: userId,
          notes: dto.notes,
          items: {
            create: dto.items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              sourceLocationId: item.sourceLocationId,
              targetLocationId: item.targetLocationId,
            })),
          },
        },
        include: { items: true },
      });

      await tx.transferHistory.create({
        data: {
          transferId: created.id,
          previousStatus: null,
          newStatus: TransferOrderStatus.REQUESTED,
          notes: 'Transferência entre HUBs solicitada.',
          changedById: userId,
        },
      });

      return created;
    });

    this.eventEmitter.emit('transfer.created', {
      transferId: transfer.id,
      transferNumber: transfer.transferNumber,
      originWarehouseId: dto.originWarehouseId,
      destinationWarehouseId: dto.destinationWarehouseId,
      requestedBy: userId,
    });

    return transfer;
  }

  async approveTransfer(transferId: string, userId: string) {
    const transfer = await this.prisma.transferOrder.findUnique({ where: { id: transferId } });
    if (!transfer) {
      throw new NotFoundException(`Transferência ${transferId} não encontrada.`);
    }

    if (transfer.status !== TransferOrderStatus.REQUESTED) {
      throw new BadRequestException(`Transferência em status ${transfer.status} não pode ser aprovada.`);
    }

    const updated = await this.prisma.transferOrder.update({
      where: { id: transferId },
      data: {
        status: TransferOrderStatus.APPROVED,
        approvedById: userId,
      },
    });

    await this.prisma.transferHistory.create({
      data: {
        transferId,
        previousStatus: transfer.status,
        newStatus: TransferOrderStatus.APPROVED,
        notes: 'Transferência aprovada pelo gestor.',
        changedById: userId,
      },
    });

    return updated;
  }

  async shipTransfer(transferId: string, userId: string) {
    const transfer = await this.prisma.transferOrder.findUnique({
      where: { id: transferId },
      include: { items: true },
    });
    if (!transfer) {
      throw new NotFoundException(`Transferência ${transferId} não encontrada.`);
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        // Reserve / deduct from origin inventory
        const inv = await tx.inventoryItem.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: transfer.originWarehouseId,
            },
          },
        });

        if (!inv || inv.quantityAvailable < item.quantity) {
          throw new BadRequestException(`Estoque insuficiente no HUB de origem durante expedição da variante ${item.variantId}.`);
        }

        await tx.inventoryItem.update({
          where: { id: inv.id },
          data: {
            quantityAvailable: { decrement: item.quantity },
            quantityInTransit: { increment: item.quantity },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: inv.id,
            type: MovementType.TRANSFER_OUT,
            quantity: item.quantity,
            previousQuantity: inv.quantityAvailable,
            newQuantity: inv.quantityAvailable - item.quantity,
            reason: `Envio de transferência ${transfer.transferNumber}`,
            referenceType: 'TRANSFER_ORDER',
            referenceId: transfer.id,
            createdById: userId,
          },
        });
      }

      const updated = await tx.transferOrder.update({
        where: { id: transferId },
        data: {
          status: TransferOrderStatus.IN_TRANSIT,
          sentAt: new Date(),
        },
      });

      await tx.transferHistory.create({
        data: {
          transferId,
          previousStatus: transfer.status,
          newStatus: TransferOrderStatus.IN_TRANSIT,
          notes: 'Produtos expedidos e em trânsito para o HUB de destino.',
          changedById: userId,
        },
      });

      return updated;
    });
  }

  async receiveTransfer(transferId: string, userId: string) {
    const transfer = await this.prisma.transferOrder.findUnique({
      where: { id: transferId },
      include: { items: true },
    });
    if (!transfer) {
      throw new NotFoundException(`Transferência ${transferId} não encontrada.`);
    }

    const updated = await this.prisma.transferOrder.update({
      where: { id: transferId },
      data: {
        status: TransferOrderStatus.RECEIVED,
        receivedAt: new Date(),
      },
    });

    await this.prisma.transferHistory.create({
      data: {
        transferId,
        previousStatus: transfer.status,
        newStatus: TransferOrderStatus.RECEIVED,
        notes: 'Transferência recebida na doca do HUB de destino.',
        changedById: userId,
      },
    });

    return updated;
  }

  async completeTransfer(transferId: string, userId: string) {
    const transfer = await this.prisma.transferOrder.findUnique({
      where: { id: transferId },
      include: { items: true },
    });
    if (!transfer) {
      throw new NotFoundException(`Transferência ${transferId} não encontrada.`);
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        // Decrease quantityInTransit at origin
        const originInv = await tx.inventoryItem.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: transfer.originWarehouseId,
            },
          },
        });
        if (originInv) {
          await tx.inventoryItem.update({
            where: { id: originInv.id },
            data: {
              quantityInTransit: { decrement: Math.min(item.quantity, originInv.quantityInTransit) },
            },
          });
        }

        // Increase quantityAvailable at destination
        const destInv = await tx.inventoryItem.upsert({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: transfer.destinationWarehouseId,
            },
          },
          create: {
            variantId: item.variantId,
            warehouseId: transfer.destinationWarehouseId,
            quantityAvailable: item.quantity,
          },
          update: {
            quantityAvailable: { increment: item.quantity },
          },
        });

        // Allocate optimal physical position in destination HUB
        const location = await this.allocationService.findOptimalLocation({
          warehouseId: transfer.destinationWarehouseId,
          quantityNeeded: item.quantity,
        });

        await this.allocationService.allocateToLocation(location.id, item.quantity, 0, 0, tx);

        await tx.transferItem.update({
          where: { id: item.id },
          data: {
            receivedQuantity: item.quantity,
            targetLocationId: location.id,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: destInv.id,
            type: MovementType.TRANSFER_IN,
            quantity: item.quantity,
            previousQuantity: destInv.quantityAvailable - item.quantity,
            newQuantity: destInv.quantityAvailable,
            reason: `Conclusão de transferência ${transfer.transferNumber}`,
            referenceType: 'TRANSFER_ORDER',
            referenceId: transfer.id,
            createdById: userId,
          },
        });
      }

      const updated = await tx.transferOrder.update({
        where: { id: transferId },
        data: { status: TransferOrderStatus.COMPLETED },
      });

      await tx.transferHistory.create({
        data: {
          transferId,
          previousStatus: transfer.status,
          newStatus: TransferOrderStatus.COMPLETED,
          notes: 'Transferência concluída e estoque disponibilizado.',
          changedById: userId,
        },
      });

      this.eventEmitter.emit('transfer.completed', {
        transferId: updated.id,
        transferNumber: updated.transferNumber,
        originWarehouseId: updated.originWarehouseId,
        destinationWarehouseId: updated.destinationWarehouseId,
        completedBy: userId,
      });

      return updated;
    });
  }

  async cancelTransfer(transferId: string, userId: string) {
    const transfer = await this.prisma.transferOrder.findUnique({ where: { id: transferId } });
    if (!transfer) throw new NotFoundException(`Transferência ${transferId} não encontrada.`);

    if (transfer.status === TransferOrderStatus.COMPLETED) {
      throw new BadRequestException('Transferência concluída não pode ser cancelada.');
    }

    const updated = await this.prisma.transferOrder.update({
      where: { id: transferId },
      data: { status: TransferOrderStatus.CANCELLED },
    });

    await this.prisma.transferHistory.create({
      data: {
        transferId,
        previousStatus: transfer.status,
        newStatus: TransferOrderStatus.CANCELLED,
        notes: 'Transferência cancelada.',
        changedById: userId,
      },
    });

    return updated;
  }

  async getTransferById(transferId: string) {
    const transfer = await this.prisma.transferOrder.findUnique({
      where: { id: transferId },
      include: {
        originWarehouse: true,
        destinationWarehouse: true,
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            variant: { include: { product: true } },
            sourceLocation: true,
            targetLocation: true,
          },
        },
        history: {
          include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!transfer) throw new NotFoundException(`Transferência ${transferId} não encontrada.`);
    return transfer;
  }

  async listTransfers(page = 1, limit = 20, originWarehouseId?: string, destinationWarehouseId?: string, status?: TransferOrderStatus) {
    const skip = (page - 1) * limit;
    const where = {
      ...(originWarehouseId && { originWarehouseId }),
      ...(destinationWarehouseId && { destinationWarehouseId }),
      ...(status && { status }),
    };

    const [transfers, total] = await Promise.all([
      this.prisma.transferOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          originWarehouse: { select: { id: true, code: true, name: true } },
          destinationWarehouse: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transferOrder.count({ where }),
    ]);

    return {
      data: transfers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
