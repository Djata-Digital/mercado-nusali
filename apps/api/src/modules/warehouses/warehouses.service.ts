import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseType, WarehouseStatus, SellerStatus } from '@prisma/client';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createWarehouse(userId: string, userRoles: string[], dto: CreateWarehouseDto, reqInfo: any) {
    const existingCode = await this.prisma.warehouse.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existingCode) {
      throw new ConflictException('Código de armazém já está em uso.');
    }

    const country = await this.prisma.country.findUnique({
      where: { code: dto.countryCode.toUpperCase() },
    });

    if (!country) {
      throw new BadRequestException('País não encontrado.');
    }

    const isAdmin = userRoles.some((r) => ['ADMIN', 'GLOBAL_ADMIN'].includes(r));

    if (!isAdmin && dto.type !== WarehouseType.SELLER_WAREHOUSE) {
      throw new ForbiddenException('Somente administradores podem criar HUBs, transit hubs ou armazéns parceiros.');
    }

    let sellerId: string | undefined = undefined;

    if (dto.type === WarehouseType.SELLER_WAREHOUSE) {
      const seller = await this.prisma.sellerProfile.findUnique({
        where: { userId },
      });

      if (!seller || seller.status !== SellerStatus.VERIFIED) {
        throw new ForbiddenException('Vendedor deve estar com status VERIFIED para cadastrar ou operar um armazém de vendedor (SELLER_WAREHOUSE).');
      }

      sellerId = seller.id;
    }

    const warehouse = await this.prisma.warehouse.create({
      data: {
        countryId: country.id,
        sellerId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        type: dto.type,
        city: dto.city,
        addressLine1: dto.addressLine1,
        capacity: dto.capacity || 0,
        status: WarehouseStatus.ACTIVE,
      },
      include: { country: true, seller: true },
    });

    await this.auditService.log({
      userId,
      action: 'WAREHOUSE_CREATED',
      entity: 'Warehouse',
      entityId: warehouse.id,
      newValue: { name: warehouse.name, code: warehouse.code, type: warehouse.type },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return warehouse;
  }

  async getMyWarehouses(userId: string) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (!seller || seller.status !== SellerStatus.VERIFIED) {
      return [];
    }

    return this.prisma.warehouse.findMany({
      where: { sellerId: seller.id, deletedAt: null },
      include: { country: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWarehouseById(userId: string, userRoles: string[], id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { country: true, seller: true, manager: true },
    });

    if (!warehouse || warehouse.deletedAt) {
      throw new NotFoundException('Armazém não encontrado.');
    }

    const isGlobalAdmin = userRoles.some((r) => ['ADMIN', 'GLOBAL_ADMIN'].includes(r));
    const isWarehouseManager = userRoles.includes('WAREHOUSE_MANAGER');
    const isLogistics = userRoles.includes('LOGISTICS');

    if (isGlobalAdmin) {
      return warehouse;
    }

    if (isWarehouseManager) {
      if (warehouse.managerId !== userId) {
        throw new ForbiddenException('Acesso negado: Você é gerente de armazém, mas este armazém não está atribuído a você.');
      }
      return warehouse;
    }

    if (isLogistics) {
      if (warehouse.type === WarehouseType.SELLER_WAREHOUSE) {
        throw new ForbiddenException('Acesso negado: Operadores de logística possuem acesso apenas a HUBs e transferências autorizadas.');
      }
      return warehouse;
    }

    // Default: Seller check
    const seller = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!seller || seller.status !== SellerStatus.VERIFIED || warehouse.sellerId !== seller.id) {
      throw new ForbiddenException('Acesso negado a este armazém.');
    }

    return warehouse;
  }

  async updateWarehouse(userId: string, userRoles: string[], id: string, dto: UpdateWarehouseDto, reqInfo: any) {
    const warehouse = await this.getWarehouseById(userId, userRoles, id);

    const updated = await this.prisma.warehouse.update({
      where: { id: warehouse.id },
      data: dto,
      include: { country: true },
    });

    await this.auditService.log({
      userId,
      action: 'WAREHOUSE_UPDATED',
      entity: 'Warehouse',
      entityId: id,
      newValue: dto,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async deleteWarehouse(userId: string, userRoles: string[], id: string, reqInfo: any) {
    const warehouse = await this.getWarehouseById(userId, userRoles, id);

    await this.prisma.warehouse.update({
      where: { id: warehouse.id },
      data: { deletedAt: new Date(), status: WarehouseStatus.CLOSED },
    });

    await this.auditService.log({
      userId,
      action: 'WAREHOUSE_DELETED',
      entity: 'Warehouse',
      entityId: id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Armazém desativado com sucesso.' };
  }

  // Admin Endpoints
  async listAdminWarehouses(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.countryId) where.countryId = query.countryId;

    const [items, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { country: true, seller: true },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async updateWarehouseStatus(adminUserId: string, id: string, status: WarehouseStatus, reqInfo: any) {
    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: { status },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: 'WAREHOUSE_STATUS_UPDATED',
      entity: 'Warehouse',
      entityId: id,
      newValue: { status },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }
}
