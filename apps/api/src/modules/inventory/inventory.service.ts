import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorePermissionsService } from '../../common/services/store-permissions.service';
import {
  AdjustInventoryDto,
  ReserveInventoryDto,
  ReleaseInventoryDto,
  TransferInventoryDto,
} from './dto/inventory-operations.dto';
import { MovementType, WarehouseType, SellerStatus, StoreMemberRole, StoreMemberStatus } from '@prisma/client';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storePermissionsService: StorePermissionsService,
  ) {}

  async listInventory(userId: string, userRoles: string[], query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('GLOBAL_ADMIN');
    const isWarehouseManager = userRoles.includes('WAREHOUSE_MANAGER');
    const isLogistics = userRoles.includes('LOGISTICS');

    const conditions: any[] = [];

    if (!isAdmin) {
      const roleConditions: any[] = [];

      // 1. Seller Profile (SELLER_WAREHOUSE owner)
      const seller = await this.prisma.sellerProfile.findUnique({ where: { userId } });
      if (seller && seller.status === SellerStatus.VERIFIED) {
        roleConditions.push({
          warehouse: {
            sellerId: seller.id,
            type: WarehouseType.SELLER_WAREHOUSE,
          },
        });
      }

      // 2. Store Members (OWNER, MANAGER, INVENTORY_MANAGER): ONLY variants of products of their authorized stores
      const memberStores = await this.prisma.storeMember.findMany({
        where: {
          userId,
          status: StoreMemberStatus.ACTIVE,
          role: { in: [StoreMemberRole.OWNER, StoreMemberRole.MANAGER, StoreMemberRole.INVENTORY_MANAGER] },
        },
        select: { storeId: true },
      });

      if (memberStores.length > 0) {
        const authorizedStoreIds = memberStores.map((m) => m.storeId);
        roleConditions.push({
          variant: {
            product: {
              storeId: { in: authorizedStoreIds },
            },
          },
        });
      }

      // 3. WAREHOUSE_MANAGER: items in assigned warehouses
      if (isWarehouseManager) {
        const managedWhs = await this.prisma.warehouse.findMany({
          where: { managerId: userId, deletedAt: null },
          select: { id: true },
        });
        if (managedWhs.length > 0) {
          roleConditions.push({
            warehouseId: { in: managedWhs.map((w) => w.id) },
          });
        }
      }

      // 4. LOGISTICS: items in HUBs
      if (isLogistics) {
        roleConditions.push({
          warehouse: {
            type: { not: WarehouseType.SELLER_WAREHOUSE },
          },
        });
      }

      if (roleConditions.length === 0) {
        return buildPaginatedResponse([], 0, page, limit);
      }

      conditions.push({ OR: roleConditions });
    }

    const where: any = conditions.length > 0 ? { AND: conditions } : {};

    if (query.warehouseId) {
      if (where.AND) where.AND.push({ warehouseId: query.warehouseId });
      else where.warehouseId = query.warehouseId;
    }

    if (query.variantId) where.variantId = query.variantId;
    if (query.productId) {
      if (!where.variant) where.variant = {};
      where.variant.productId = query.productId;
    }
    if (query.search) {
      const searchCondition = {
        OR: [
          { sku: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
          { product: { title: { contains: query.search, mode: 'insensitive' } } },
        ],
      };
      if (where.variant) {
        where.variant = { AND: [where.variant, searchCondition] };
      } else {
        where.variant = searchCondition;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          warehouse: true,
          variant: { include: { product: { include: { store: true } } } },
        },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getInventoryItemById(userId: string, userRoles: string[], id: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        warehouse: true,
        variant: { include: { product: { include: { store: true } } } },
      },
    });

    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    await this.validateInventoryAuthorization(userId, userRoles, item.warehouse, item.variant.product.storeId, false);

    return item;
  }

  async adjustStock(userId: string, userRoles: string[], dto: AdjustInventoryDto, reqInfo: any) {
    const warehouse = await this.getWarehouseWithCheck(dto.warehouseId);
    const variant = await this.getVariantWithCheck(dto.variantId);
    await this.validateInventoryAuthorization(userId, userRoles, warehouse, variant.product.storeId, true);

    const result = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.upsert({
        where: {
          variantId_warehouseId: {
            variantId: dto.variantId,
            warehouseId: dto.warehouseId,
          },
        },
        create: {
          variantId: dto.variantId,
          warehouseId: dto.warehouseId,
          quantityAvailable: 0,
          quantityReserved: 0,
        },
        update: {},
      });

      const previousQuantity = item.quantityAvailable;

      // 1. Delta adjustment mode
      if (dto.quantityDelta !== undefined && dto.quantityDelta !== null) {
        const delta = dto.quantityDelta;
        const movementType = delta >= 0 ? MovementType.IN : MovementType.OUT;

        if (delta > 0) {
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { quantityAvailable: { increment: delta } },
          });
        } else if (delta < 0) {
          const decCount = await tx.inventoryItem.updateMany({
            where: {
              id: item.id,
              quantityAvailable: { gte: Math.abs(delta) },
            },
            data: { quantityAvailable: { decrement: Math.abs(delta) } },
          });
          if (decCount.count === 0) {
            throw new BadRequestException('Estoque insuficiente para aplicar a redução solicitada durante ajuste concorrente.');
          }
        }

        const updatedItem = (await tx.inventoryItem.findUnique({ where: { id: item.id } }))!;

        await tx.inventoryMovement.create({
          data: {
            inventoryItemId: item.id,
            type: movementType,
            quantity: Math.abs(delta),
            previousQuantity,
            newQuantity: updatedItem.quantityAvailable,
            reason: dto.reason || 'Ajuste relativo por delta de estoque',
            createdById: userId,
          },
        });

        return updatedItem;
      }

      // 2. Absolute quantity setting mode
      const targetQuantity = dto.newQuantity ?? 0;

      // Optimistic concurrency control if expectedQuantityAvailable provided
      if (dto.expectedQuantityAvailable !== undefined && dto.expectedQuantityAvailable !== null) {
        const setUpdated = await tx.inventoryItem.updateMany({
          where: {
            id: item.id,
            quantityAvailable: dto.expectedQuantityAvailable,
          },
          data: { quantityAvailable: targetQuantity },
        });

        if (setUpdated.count === 0) {
          throw new ConflictException('Conflito de modificação concorrente de estoque. O estoque foi alterado por outra transação.');
        }
      } else {
        // Atomic delta calculation
        const delta = targetQuantity - previousQuantity;
        if (delta > 0) {
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { quantityAvailable: { increment: delta } },
          });
        } else if (delta < 0) {
          const decCount = await tx.inventoryItem.updateMany({
            where: {
              id: item.id,
              quantityAvailable: { gte: Math.abs(delta) },
            },
            data: { quantityAvailable: { decrement: Math.abs(delta) } },
          });
          if (decCount.count === 0) {
            throw new ConflictException('Conflito de modificação concorrente de estoque. O estoque foi alterado por outra transação.');
          }
        }
      }

      const updatedItem = (await tx.inventoryItem.findUnique({ where: { id: item.id } }))!;
      const delta = updatedItem.quantityAvailable - previousQuantity;
      const movementType = delta >= 0 ? MovementType.IN : MovementType.OUT;

      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type: movementType,
          quantity: Math.abs(delta),
          previousQuantity,
          newQuantity: updatedItem.quantityAvailable,
          reason: dto.reason || 'Ajuste absoluto de estoque',
          createdById: userId,
        },
      });

      return updatedItem;
    });

    await this.auditService.log({
      userId,
      action: 'INVENTORY_ADJUSTED',
      entity: 'InventoryItem',
      entityId: result.id,
      newValue: { newQuantity: dto.newQuantity, quantityDelta: dto.quantityDelta, reason: dto.reason },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return result;
  }

  async reserveStock(userId: string, userRoles: string[], dto: ReserveInventoryDto, reqInfo: any) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: dto.inventoryItemId },
      include: {
        warehouse: true,
        variant: { include: { product: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    await this.validateInventoryAuthorization(userId, userRoles, item.warehouse, item.variant.product.storeId, true);

    if (dto.quantity <= 0) {
      throw new BadRequestException('A quantidade a reservar deve ser maior que zero.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedCount = await tx.inventoryItem.updateMany({
        where: {
          id: item.id,
          quantityAvailable: { gte: dto.quantity },
        },
        data: {
          quantityAvailable: { decrement: dto.quantity },
          quantityReserved: { increment: dto.quantity },
        },
      });

      if (updatedCount.count === 0) {
        throw new BadRequestException('Estoque disponível insuficiente para realizar a reserva.');
      }

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } });

      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type: MovementType.RESERVATION,
          quantity: dto.quantity,
          previousQuantity: item.quantityAvailable,
          newQuantity: updatedItem!.quantityAvailable,
          reason: dto.reason || 'Reserva atômica para pedido',
          createdById: userId,
        },
      });

      return updatedItem!;
    });

    await this.auditService.log({
      userId,
      action: 'INVENTORY_RESERVED',
      entity: 'InventoryItem',
      entityId: item.id,
      newValue: { reservedQuantity: dto.quantity },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return result;
  }

  async releaseStock(userId: string, userRoles: string[], dto: ReleaseInventoryDto, reqInfo: any) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: dto.inventoryItemId },
      include: {
        warehouse: true,
        variant: { include: { product: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    await this.validateInventoryAuthorization(userId, userRoles, item.warehouse, item.variant.product.storeId, true);

    if (dto.quantity <= 0) {
      throw new BadRequestException('A quantidade a liberar deve ser maior que zero.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedCount = await tx.inventoryItem.updateMany({
        where: {
          id: item.id,
          quantityReserved: { gte: dto.quantity },
        },
        data: {
          quantityReserved: { decrement: dto.quantity },
          quantityAvailable: { increment: dto.quantity },
        },
      });

      if (updatedCount.count === 0) {
        throw new BadRequestException('Quantidade reservada insuficiente para realizar a liberação.');
      }

      const updatedItem = await tx.inventoryItem.findUnique({ where: { id: item.id } });

      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type: MovementType.RELEASE,
          quantity: dto.quantity,
          previousQuantity: item.quantityAvailable,
          newQuantity: updatedItem!.quantityAvailable,
          reason: dto.reason || 'Liberação atômica de reserva',
          createdById: userId,
        },
      });

      return updatedItem!;
    });

    await this.auditService.log({
      userId,
      action: 'INVENTORY_RELEASED',
      entity: 'InventoryItem',
      entityId: item.id,
      newValue: { releasedQuantity: dto.quantity },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return result;
  }

  async transferStock(userId: string, userRoles: string[], dto: TransferInventoryDto, reqInfo: any) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Armazém de origem e destino devem ser diferentes.');
    }

    const fromWarehouse = await this.getWarehouseWithCheck(dto.fromWarehouseId);
    const toWarehouse = await this.getWarehouseWithCheck(dto.toWarehouseId);
    const variant = await this.getVariantWithCheck(dto.variantId);

    await this.validateInventoryAuthorization(userId, userRoles, fromWarehouse, variant.product.storeId, true);
    await this.validateInventoryAuthorization(userId, userRoles, toWarehouse, variant.product.storeId, true);

    const result = await this.prisma.$transaction(async (tx) => {
      let fromItem = await tx.inventoryItem.findUnique({
        where: {
          variantId_warehouseId: {
            variantId: dto.variantId,
            warehouseId: dto.fromWarehouseId,
          },
        },
      });

      if (!fromItem || fromItem.quantityAvailable < dto.quantity) {
        throw new BadRequestException('Estoque disponível insuficiente no armazém de origem para realizar a transferência.');
      }

      // Requirement 8: Use upsert for target item to prevent race conditions / unique key errors under concurrent transfers
      const toItem = await tx.inventoryItem.upsert({
        where: {
          variantId_warehouseId: {
            variantId: dto.variantId,
            warehouseId: dto.toWarehouseId,
          },
        },
        create: {
          variantId: dto.variantId,
          warehouseId: dto.toWarehouseId,
          quantityAvailable: 0,
          quantityReserved: 0,
        },
        update: {},
      });

      // Atomic conditional decrement from origin
      const fromUpdated = await tx.inventoryItem.updateMany({
        where: {
          id: fromItem.id,
          quantityAvailable: { gte: dto.quantity },
        },
        data: { quantityAvailable: { decrement: dto.quantity } },
      });

      if (fromUpdated.count === 0) {
        throw new BadRequestException('Falha de concorrência: Estoque de origem foi alterado por outra transação.');
      }

      // Increment destination
      const updatedTo = await tx.inventoryItem.update({
        where: { id: toItem.id },
        data: { quantityAvailable: { increment: dto.quantity } },
      });

      const updatedFrom = (await tx.inventoryItem.findUnique({ where: { id: fromItem.id } }))!;

      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: fromItem.id,
          type: MovementType.TRANSFER_OUT,
          quantity: dto.quantity,
          previousQuantity: fromItem.quantityAvailable,
          newQuantity: updatedFrom.quantityAvailable,
          reason: dto.reason || `Transferência enviada para armazém ${dto.toWarehouseId}`,
          createdById: userId,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: toItem.id,
          type: MovementType.TRANSFER_IN,
          quantity: dto.quantity,
          previousQuantity: toItem.quantityAvailable,
          newQuantity: updatedTo.quantityAvailable,
          reason: dto.reason || `Transferência recebida do armazém ${dto.fromWarehouseId}`,
          createdById: userId,
        },
      });

      return { fromItem: updatedFrom, toItem: updatedTo };
    });

    await this.auditService.log({
      userId,
      action: 'INVENTORY_TRANSFERRED',
      entity: 'InventoryItem',
      entityId: result.fromItem.id,
      newValue: {
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        quantity: dto.quantity,
      },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return result;
  }

  async getMovementsByItem(userId: string, userRoles: string[], inventoryItemId: string, query: any) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: {
        warehouse: true,
        variant: { include: { product: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado.');
    }

    await this.validateInventoryAuthorization(userId, userRoles, item.warehouse, item.variant.product.storeId, false);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where: { inventoryItemId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { createdBy: true },
      }),
      this.prisma.inventoryMovement.count({ where: { inventoryItemId } }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  private async validateInventoryAuthorization(
    userId: string,
    userRoles: string[],
    warehouse: any,
    storeId: string,
    isWriteOperation = false,
  ) {
    if (userRoles.includes('ADMIN') || userRoles.includes('GLOBAL_ADMIN')) {
      return;
    }

    const isWarehouseManager = userRoles.includes('WAREHOUSE_MANAGER');
    if (isWarehouseManager) {
      if (warehouse.managerId !== userId) {
        throw new ForbiddenException('Acesso negado: Você é gerente de armazém, mas este armazém não está sob sua gestão.');
      }
      return;
    }

    const isLogistics = userRoles.includes('LOGISTICS');
    if (isLogistics) {
      if (warehouse.type === WarehouseType.SELLER_WAREHOUSE) {
        throw new ForbiddenException('Acesso negado: Operadores de logística possuem acesso apenas a HUBs.');
      }
      return;
    }

    // Check if seller profile owns the seller warehouse (must be VERIFIED)
    if (warehouse.type === WarehouseType.SELLER_WAREHOUSE && warehouse.sellerId) {
      const seller = await this.prisma.sellerProfile.findUnique({ where: { userId } });
      if (seller && seller.status === SellerStatus.VERIFIED && warehouse.sellerId === seller.id) {
        return;
      }
    }

    // Check if user is member of the store with authorized role via StorePermissionsService
    const action = isWriteOperation ? 'MANAGE_INVENTORY' : 'VIEW_INVENTORY';
    await this.storePermissionsService.validateStoreAccess(userId, storeId, action);
  }

  private async getWarehouseWithCheck(warehouseId: string) {
    const wh = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!wh || wh.deletedAt) throw new NotFoundException('Armazém não encontrado.');
    return wh;
  }

  private async getVariantWithCheck(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant || variant.deletedAt) throw new NotFoundException('Variante não encontrada.');
    return variant;
  }
}
