import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePickingOrderDto,
  CreatePickingBatchDto,
  CompletePickingOrderDto,
  CancelPickingOrderDto,
} from '../dto/picking.dto';
import { PickingOrderStatus, PickingBatchType, PickingBatchStatus, OrderStatus, Prisma } from '@prisma/client';
import { recordOutboxEvent } from '../helpers/outbox.helper';
import { changeOrderStatusInTransaction } from '../helpers/order-status-history.helper';
import { validateHubAccess } from '../helpers/hub-authorization.helper';

@Injectable()
export class PickingService {
  constructor(private readonly prisma: PrismaService) {}

  private async withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    let attempt = 0;
    while (attempt < retries) {
      try {
        return await fn();
      } catch (error: any) {
        attempt++;
        if (error?.code === 'P2034' || error?.code === '40001') {
          if (attempt >= retries) throw error;
          await new Promise((res) => setTimeout(res, 50 * attempt));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Falha na transação após múltiplas tentativas.');
  }

  async createPickingOrder(dto: CreatePickingOrderDto, userId?: string, user?: any) {
    if (user) {
      await validateHubAccess(this.prisma, user, dto.warehouseId);
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: { include: { variant: true } },
        orderGroup: {
          include: {
            stockReservations: {
              where: { status: { in: ['CONFIRMED', 'ACTIVE'] } },
              include: {
                items: {
                  include: {
                    inventoryItem: true,
                    warehouse: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${dto.orderId} não encontrado.`);
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException(`Armazém/HUB ${dto.warehouseId} não encontrado.`);
    }

    const reservationItems = order.orderGroup?.stockReservations.flatMap((r) => r.items) || [];
    const warehouseReservationItems = reservationItems.filter((i) => i.warehouseId === dto.warehouseId);

    if (warehouseReservationItems.length === 0) {
      throw new BadRequestException(
        `Não existe reserva de estoque (StockReservationItem) ativa para este pedido no Armazém/HUB ${dto.warehouseId}.`,
      );
    }

    for (const resItem of warehouseReservationItems) {
      const activeItemUse = await this.prisma.pickingItem.findFirst({
        where: {
          stockReservationItemId: resItem.id,
          pickingOrder: { status: { notIn: [PickingOrderStatus.CANCELLED] } },
        },
      });
      if (activeItemUse) {
        throw new ConflictException({
          statusCode: 409,
          message: `A reserva de estoque (${resItem.id}) já está associada a outra Ordem de Picking ativa.`,
          errorCode: 'PICKING_RESERVATION_ALREADY_USED',
        });
      }

      if (!resItem.inventoryItem || !resItem.inventoryItem.locationId) {
        throw new BadRequestException(
          `O item de estoque (${resItem.inventoryItemId}) do produto ${resItem.variantId} não possui uma localização física associada (locationId).`,
        );
      }
    }

    const existing = await this.prisma.pickingOrder.findFirst({
      where: {
        orderId: dto.orderId,
        warehouseId: dto.warehouseId,
        status: { notIn: [PickingOrderStatus.CANCELLED] },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Já existe uma Ordem de Picking ativa para o pedido ${order.orderNumber} no armazém ${dto.warehouseId}.`,
      );
    }

    const pickingNumber = `PCK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return await this.withRetry(async () => {
      try {
        const pickingOrder = await this.prisma.$transaction(
          async (tx) => {
            const created = await tx.pickingOrder.create({
              data: {
                pickingNumber,
                orderId: dto.orderId,
                warehouseId: dto.warehouseId,
                status: PickingOrderStatus.CREATED,
                notes: dto.notes,
              },
            });

            for (const resItem of warehouseReservationItems) {
              await tx.pickingItem.create({
                data: {
                  pickingOrderId: created.id,
                  orderItemId: resItem.orderItemId,
                  variantId: resItem.variantId,
                  stockReservationItemId: resItem.id,
                  inventoryItemId: resItem.inventoryItemId,
                  locationId: resItem.inventoryItem.locationId,
                  expectedQuantity: resItem.quantity,
                  pickedQuantity: 0,
                  status: PickingOrderStatus.CREATED,
                } as any,
              });
            }

            await tx.pickingHistory.create({
              data: {
                pickingOrderId: created.id,
                previousStatus: null,
                newStatus: PickingOrderStatus.CREATED,
                notes: 'Ordem de Picking gerada a partir da alocação da reserva',
                changedById: userId || null,
              },
            });

            if (order.status === OrderStatus.PAID) {
              await changeOrderStatusInTransaction(tx, order.id, OrderStatus.PREPARING, 'Geração de Ordem de Picking', userId);
            }

            await recordOutboxEvent(tx, 'PickingOrder', created.id, 'picking.created', {
              pickingOrderId: created.id,
              pickingNumber,
              orderId: dto.orderId,
              warehouseId: dto.warehouseId,
              createdBy: userId,
            });

            return created;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        return this.getPickingOrderById(pickingOrder.id, user);
      } catch (error: any) {
        if (
          error?.code === 'P2002' ||
          (error?.message && error.message.includes('picking_items_active_stock_reservation_idx'))
        ) {
          const existing = await this.prisma.pickingOrder.findFirst({
            where: {
              orderId: dto.orderId,
              warehouseId: dto.warehouseId,
              status: { notIn: [PickingOrderStatus.CANCELLED] },
            },
          });
          if (existing) {
            return this.getPickingOrderById(existing.id, user);
          }
          throw new ConflictException({
            statusCode: 409,
            message: 'A reserva de estoque já está associada a outra Ordem de Picking ativa.',
            errorCode: 'PICKING_RESERVATION_ALREADY_USED',
          });
        }
        throw error;
      }
    });
  }

  // Método idempotente para geração automática de ordens de picking para todos os armazéns do pedido
  async createPickingOrdersForOrder(orderId: string, userId?: string, user?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderGroup: {
          include: {
            stockReservations: {
              where: { status: { in: ['CONFIRMED', 'ACTIVE'] } },
              include: { items: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Pedido ${orderId} não encontrado.`);
    }

    const reservationItems = order.orderGroup?.stockReservations.flatMap((r) => r.items) || [];
    if (reservationItems.length === 0) {
      throw new BadRequestException(`Não existem reservas de estoque ativas para o pedido ${orderId}.`);
    }

    const distinctWarehouseIds = Array.from(new Set(reservationItems.map((item) => item.warehouseId)));

    const pickingOrders: any[] = [];
    for (const warehouseId of distinctWarehouseIds) {
      const expectedResItemIds = reservationItems
        .filter((item) => item.warehouseId === warehouseId)
        .map((item) => item.id)
        .sort();

      const existing = await this.prisma.pickingOrder.findFirst({
        where: { orderId, warehouseId, status: { notIn: [PickingOrderStatus.CANCELLED] } },
        include: { items: true },
      });

      if (existing) {
        const existingResItemIds = existing.items
          .map((i) => i.stockReservationItemId)
          .filter((id): id is string => Boolean(id))
          .sort();

        const isExactMatch =
          expectedResItemIds.length === existingResItemIds.length &&
          expectedResItemIds.every((id, idx) => id === existingResItemIds[idx]);

        if (isExactMatch) {
          pickingOrders.push(existing);
          continue;
        } else {
          throw new ConflictException(
            `Conflito de integridade: a Ordem de Picking ativa para o armazém ${warehouseId} contém reservas divergentes das esperadas.`,
          );
        }
      }

      try {
        const created = await this.createPickingOrder({ orderId, warehouseId }, userId, user);
        pickingOrders.push(created);
      } catch (err: any) {
        const concurrentExisting = await this.prisma.pickingOrder.findFirst({
          where: { orderId, warehouseId, status: { notIn: [PickingOrderStatus.CANCELLED] } },
          include: { items: true },
        });

        if (concurrentExisting) {
          const existingResItemIds = concurrentExisting.items
            .map((i) => i.stockReservationItemId)
            .filter((id): id is string => Boolean(id))
            .sort();

          const isExactMatch =
            expectedResItemIds.length === existingResItemIds.length &&
            expectedResItemIds.every((id, idx) => id === existingResItemIds[idx]);

          if (isExactMatch) {
            pickingOrders.push(concurrentExisting);
            continue;
          }
        }
        throw err;
      }
    }

    return {
      orderId,
      totalWarehouses: distinctWarehouseIds.length,
      pickingOrders,
    };
  }

  async createBatch(dto: CreatePickingBatchDto, userId?: string, user?: any) {
    if (user) {
      await validateHubAccess(this.prisma, user, dto.warehouseId);
    }

    if (!dto.pickingOrderIds || dto.pickingOrderIds.length === 0) {
      throw new BadRequestException('Informe ao menos uma Ordem de Picking para formar o lote.');
    }

    const pickingOrders = await this.prisma.pickingOrder.findMany({
      where: { id: { in: dto.pickingOrderIds } },
    });

    if (pickingOrders.length !== dto.pickingOrderIds.length) {
      throw new BadRequestException('Um ou mais IDs de Ordem de Picking não foram encontrados.');
    }

    for (const pck of pickingOrders) {
      if (pck.warehouseId !== dto.warehouseId) {
        throw new BadRequestException(`A Ordem de Picking ${pck.pickingNumber} pertence a outro armazém (${pck.warehouseId}).`);
      }
      if (pck.status !== PickingOrderStatus.CREATED) {
        throw new BadRequestException(`A Ordem de Picking ${pck.pickingNumber} não está no status CREATED (status atual: ${pck.status}).`);
      }
      if (pck.batchId) {
        throw new BadRequestException(`A Ordem de Picking ${pck.pickingNumber} já está associada ao lote ${pck.batchId}.`);
      }
    }

    const batchNumber = `WAVE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.pickingBatch.create({
        data: {
          batchNumber,
          warehouseId: dto.warehouseId,
          type: dto.type,
          status: PickingBatchStatus.ASSIGNED,
          assignedOperatorId: dto.assignedOperatorId || userId || null,
        },
      });

      for (const orderId of dto.pickingOrderIds) {
        await tx.pickingOrder.update({
          where: { id: orderId },
          data: {
            batchId: createdBatch.id,
            status: PickingOrderStatus.ASSIGNED,
            assignedOperatorId: dto.assignedOperatorId || userId || null,
          },
        });

        await tx.pickingHistory.create({
          data: {
            pickingOrderId: orderId,
            previousStatus: PickingOrderStatus.CREATED,
            newStatus: PickingOrderStatus.ASSIGNED,
            notes: `Agrupado no Lote ${batchNumber} (${dto.type})`,
            changedById: userId || null,
          },
        });
      }

      return createdBatch;
    });

    return batch;
  }

  // Exigência 4: assignOperator atômico (atribuir se vazio; substituição com admin/motivo; 409 em conflito)
  async assignOperator(pickingOrderId: string, operatorId: string, reason?: string, userId?: string, user?: any) {
    const pickingOrder = await this.prisma.pickingOrder.findUnique({ where: { id: pickingOrderId } });
    if (!pickingOrder) {
      throw new NotFoundException(`Ordem de Picking ${pickingOrderId} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, pickingOrder.warehouseId);
    }

    if (pickingOrder.status === PickingOrderStatus.CANCELLED || pickingOrder.status === PickingOrderStatus.PICKED) {
      throw new BadRequestException(`Não é possível atribuir operador para Ordem de Picking no status ${pickingOrder.status}.`);
    }

    // Se já houver operador atribuído
    if (pickingOrder.assignedOperatorId && pickingOrder.assignedOperatorId !== operatorId) {
      const userRoles: string[] = user && Array.isArray(user.roles)
        ? user.roles.map((r: any) => (typeof r === 'string' ? r : r.role?.name || r.name))
        : [];
      const isGlobalAdmin = userRoles.includes('ADMIN') || userRoles.includes('GLOBAL_ADMIN');

      if (!isGlobalAdmin || !reason || reason.trim() === '') {
        throw new ConflictException(
          'A Ordem de Picking já possui um operador atribuído. Substituição de operador requer permissão administrativa e motivo justificado.',
        );
      }
    }

    // Atualização atômica condicional
    const updateResult = await this.prisma.pickingOrder.updateMany({
      where: {
        id: pickingOrderId,
        OR: [
          { assignedOperatorId: null },
          { assignedOperatorId: pickingOrder.assignedOperatorId },
        ],
      },
      data: {
        assignedOperatorId: operatorId,
        status: pickingOrder.status === PickingOrderStatus.CREATED ? PickingOrderStatus.ASSIGNED : pickingOrder.status,
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictException('Conflito de atribuição: o operador da Ordem de Picking foi modificado por outro usuário.');
    }

    const updated = await this.prisma.pickingOrder.findUnique({ where: { id: pickingOrderId } });

    await this.prisma.pickingHistory.create({
      data: {
        pickingOrderId,
        previousStatus: pickingOrder.status,
        newStatus: updated!.status,
        notes: `Operador ${operatorId} atribuído à separação. ${reason ? 'Motivo: ' + reason : ''}`,
        changedById: userId || null,
      },
    });

    return updated;
  }

  async startPicking(pickingOrderId: string, userId?: string, user?: any) {
    const pickingOrder = await this.prisma.pickingOrder.findUnique({ where: { id: pickingOrderId } });
    if (!pickingOrder) {
      throw new NotFoundException(`Ordem de Picking ${pickingOrderId} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, pickingOrder.warehouseId);
    }

    const updateResult = await this.prisma.pickingOrder.updateMany({
      where: {
        id: pickingOrderId,
        status: { in: [PickingOrderStatus.CREATED, PickingOrderStatus.ASSIGNED] },
        OR: [
          { assignedOperatorId: null },
          { assignedOperatorId: userId },
        ],
      },
      data: {
        status: PickingOrderStatus.IN_PROGRESS,
        startedAt: new Date(),
        assignedOperatorId: userId || null,
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictException(`Ordem de Picking já iniciada por outro operador ou em status incompatível (${pickingOrder.status}).`);
    }

    const updated = await this.prisma.pickingOrder.findUnique({ where: { id: pickingOrderId } });

    await this.prisma.pickingHistory.create({
      data: {
        pickingOrderId,
        previousStatus: pickingOrder.status,
        newStatus: PickingOrderStatus.IN_PROGRESS,
        notes: 'Separação iniciada pelo operador',
        changedById: userId || null,
      },
    });

    return updated;
  }

  // Exigência 3: pickItems aceita execução SOMENTE quando PickingOrder.status === IN_PROGRESS (atualização condicional atômica)
  async pickItems(pickingOrderId: string, dto: CompletePickingOrderDto, userId?: string, user?: any) {
    const pickingOrder = await this.prisma.pickingOrder.findUnique({
      where: { id: pickingOrderId },
      include: { items: true },
    });
    if (!pickingOrder) {
      throw new NotFoundException(`Ordem de Picking ${pickingOrderId} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, pickingOrder.warehouseId);
    }

    if (pickingOrder.status !== PickingOrderStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Separação de itens permitida somente quando a Ordem de Picking estiver no status IN_PROGRESS. Status atual: ${pickingOrder.status}`,
      );
    }

    const dtoItemIds = dto.items.map((i) => i.pickingItemId);
    const uniqueDtoItemIds = new Set(dtoItemIds);
    if (uniqueDtoItemIds.size !== dtoItemIds.length) {
      throw new BadRequestException('Requisição contém itens de separação duplicados.');
    }

    const expectedItemIds = pickingOrder.items.map((i) => i.id);
    if (dtoItemIds.length !== expectedItemIds.length || !expectedItemIds.every((id) => uniqueDtoItemIds.has(id))) {
      throw new BadRequestException('A lista de itens enviada deve corresponder exatamente a todos os itens da Ordem de Picking.');
    }

    for (const pickItem of dto.items) {
      const item = pickingOrder.items.find((i) => i.id === pickItem.pickingItemId);
      if (!item) continue;

      if (pickItem.pickedQuantity < 0 || pickItem.pickedQuantity > item.expectedQuantity) {
        throw new BadRequestException(`Quantidade separada (${pickItem.pickedQuantity}) inválida para o item. Deve estar entre 0 e ${item.expectedQuantity}.`);
      }

      // Validação de localização
      if (pickItem.locationCode) {
        const loc = await this.prisma.hubLocation.findUnique({ where: { code: pickItem.locationCode } });
        if (!loc || loc.warehouseId !== pickingOrder.warehouseId) {
          throw new BadRequestException(`A localização física ${pickItem.locationCode} não pertence ao armazém (${pickingOrder.warehouseId}).`);
        }
        if (item.locationId && item.locationId !== loc.id) {
          throw new BadRequestException(`A posição ${pickItem.locationCode} não corresponde à posição de alocação do produto.`);
        }
      }
    }

    let allPicked = true;
    let anyPicked = false;

    await this.prisma.$transaction(async (tx) => {
      // Atualização condicional da ordem de picking para evitar finalização simultânea por outro processo
      const lockRes = await tx.pickingOrder.updateMany({
        where: { id: pickingOrderId, status: PickingOrderStatus.IN_PROGRESS },
        data: { updatedAt: new Date() },
      });

      if (lockRes.count === 0) {
        throw new ConflictException('A Ordem de Picking foi finalizada ou alterada por outro operador concorrentemente.');
      }

      for (const pickItem of dto.items) {
        const item = pickingOrder.items.find((i) => i.id === pickItem.pickingItemId)!;

        let locationId = item.locationId;
        if (pickItem.locationCode) {
          const loc = await tx.hubLocation.findUnique({ where: { code: pickItem.locationCode } });
          if (loc) locationId = loc.id;
        }

        const isFullyPicked = pickItem.pickedQuantity >= item.expectedQuantity;
        if (!isFullyPicked) allPicked = false;
        if (pickItem.pickedQuantity > 0) anyPicked = true;

        await tx.pickingItem.update({
          where: { id: item.id },
          data: {
            pickedQuantity: pickItem.pickedQuantity,
            locationId,
            status: isFullyPicked ? PickingOrderStatus.PICKED : PickingOrderStatus.PARTIALLY_PICKED,
            operatorId: userId || pickingOrder.assignedOperatorId || null,
            pickedAt: new Date(),
            notes: pickItem.notes,
          },
        });
      }

      const finalStatus = allPicked
        ? PickingOrderStatus.PICKED
        : anyPicked
        ? PickingOrderStatus.PARTIALLY_PICKED
        : PickingOrderStatus.IN_PROGRESS;

      await tx.pickingOrder.update({
        where: { id: pickingOrderId },
        data: {
          status: finalStatus,
          completedAt: allPicked ? new Date() : null,
        },
      });

      await tx.pickingHistory.create({
        data: {
          pickingOrderId,
          previousStatus: pickingOrder.status,
          newStatus: finalStatus,
          notes: `Conferência de itens lançada. Status final: ${finalStatus}`,
          changedById: userId || null,
        },
      });

      // Exigência 10 & 13: OutboxEvent (sem duplicação via EventEmitter)
      if (allPicked) {
        await recordOutboxEvent(tx, 'PickingOrder', pickingOrderId, 'picking.completed', {
          pickingOrderId,
          pickingNumber: pickingOrder.pickingNumber,
          orderId: pickingOrder.orderId,
          completedBy: userId,
        });
      }
    });

    return this.getPickingOrderById(pickingOrderId, user);
  }

  async cancelPicking(pickingOrderId: string, dto: CancelPickingOrderDto, userId?: string, user?: any) {
    const pickingOrder = await this.prisma.pickingOrder.findUnique({ where: { id: pickingOrderId } });
    if (!pickingOrder) {
      throw new NotFoundException(`Ordem de Picking ${pickingOrderId} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, pickingOrder.warehouseId);
    }

    if (pickingOrder.status === PickingOrderStatus.PICKED) {
      throw new BadRequestException('Ordem de Picking já foi concluída e não pode ser cancelada diretamente.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const lockRes = await tx.pickingOrder.updateMany({
        where: { id: pickingOrderId, status: { notIn: [PickingOrderStatus.CANCELLED] } },
        data: {
          status: PickingOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
        },
      });

      if (lockRes.count > 0) {
        await tx.pickingItem.updateMany({
          where: { pickingOrderId },
          data: { status: PickingOrderStatus.CANCELLED },
        });

        await tx.pickingHistory.create({
          data: {
            pickingOrderId,
            previousStatus: pickingOrder.status,
            newStatus: PickingOrderStatus.CANCELLED,
            notes: `Picking cancelado. Motivo: ${dto.reason}`,
            changedById: userId || null,
          },
        });

        await recordOutboxEvent(tx, 'PickingOrder', pickingOrderId, 'picking.cancelled', {
          pickingOrderId,
          pickingNumber: pickingOrder.pickingNumber,
          orderId: pickingOrder.orderId,
          cancelledBy: userId,
        });
      }

      return tx.pickingOrder.findUnique({ where: { id: pickingOrderId } });
    });

    return updated!;
  }

  // Exigência 5: Restringir reopenPicking (apenas antes de PackingOrder existir; impedir se packing/etiqueta/shipment/manifest existirem; exigir motivo)
  async reopenPicking(pickingOrderId: string, reason?: string, userId?: string, user?: any) {
    const pickingOrder = await this.prisma.pickingOrder.findUnique({ where: { id: pickingOrderId } });
    if (!pickingOrder) {
      throw new NotFoundException(`Ordem de Picking ${pickingOrderId} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, pickingOrder.warehouseId);
    }

    if (!reason || reason.trim() === '') {
      throw new BadRequestException('Motivo da reabertura da Ordem de Picking é obrigatório.');
    }

    // Verificar se já existe PackingOrder associada
    const packingOrder = await this.prisma.packingOrder.findUnique({
      where: { pickingOrderId },
      include: { shippingLabel: true, shipment: true },
    });

    if (packingOrder) {
      throw new BadRequestException(
        'Não é possível reabrir a Ordem de Picking pois já existe uma Ordem de Embalagem (PackingOrder) criada para ela.',
      );
    }

    const updated = await this.prisma.pickingOrder.update({
      where: { id: pickingOrderId },
      data: {
        status: PickingOrderStatus.IN_PROGRESS,
        completedAt: null,
        cancelledAt: null,
        cancellationReason: null,
      },
    });

    await this.prisma.pickingHistory.create({
      data: {
        pickingOrderId,
        previousStatus: pickingOrder.status,
        newStatus: PickingOrderStatus.IN_PROGRESS,
        notes: `Ordem de Picking reaberta. Motivo: ${reason}`,
        changedById: userId || null,
      },
    });

    return updated;
  }

  async listPickingOrders(
    page = 1,
    limit = 20,
    warehouseId?: string,
    status?: PickingOrderStatus,
    batchId?: string,
    user?: any,
  ) {
    const allowedWarehouses = user ? await validateHubAccess(this.prisma, user, warehouseId) : null;
    const skip = (page - 1) * limit;

    const where = {
      ...(warehouseId && { warehouseId }),
      ...(allowedWarehouses && { warehouseId: { in: allowedWarehouses } }),
      ...(status && { status }),
      ...(batchId && { batchId }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.pickingOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          order: { select: { id: true, orderNumber: true, total: true } },
          assignedOperator: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pickingOrder.count({ where }),
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

  async getPickingOrderById(id: string, user?: any) {
    const pickingOrder = await this.prisma.pickingOrder.findUnique({
      where: { id },
      include: {
        order: true,
        warehouse: true,
        batch: true,
        assignedOperator: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: {
            variant: { include: { product: true } },
            location: true,
            operator: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        history: {
          include: {
            changedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!pickingOrder) {
      throw new NotFoundException(`Ordem de Picking ${id} não encontrada.`);
    }

    if (user) {
      await validateHubAccess(this.prisma, user, pickingOrder.warehouseId);
    }

    return pickingOrder;
  }
}
