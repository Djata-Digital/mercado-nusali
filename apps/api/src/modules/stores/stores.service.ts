import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MinioService } from '../storage/minio.service';
import { AuditService } from '../audit/audit.service';
import { StorePermissionsService } from '../../common/services/store-permissions.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoreStatus, SellerStatus, ProductStatus } from '@prisma/client';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly minioService: MinioService,
    private readonly auditService: AuditService,
    private readonly storePermissionsService: StorePermissionsService,
  ) {}

  private mapStorePublicUrls(store: any) {
    if (!store) return store;
    const canBuildPublicUrl = typeof (this.minioService as any)?.getPublicUrl === 'function';
    const logoUrl = store.logoKey && canBuildPublicUrl
      ? this.minioService.getPublicUrl(store.logoKey)
      : (store.logoUrl || null);
    const bannerUrl = store.bannerKey && canBuildPublicUrl
      ? this.minioService.getPublicUrl(store.bannerKey)
      : (store.bannerUrl || null);

    return {
      ...store,
      logoUrl,
      bannerUrl,
    };
  }

  private mapPublicStore(store: any) {
    const mapped = this.mapStorePublicUrls(store);
    return {
      id: mapped.id,
      sellerId: mapped.sellerId,
      countryId: mapped.countryId,
      name: mapped.name,
      slug: mapped.slug,
      description: mapped.description,
      logoUrl: mapped.logoUrl,
      bannerUrl: mapped.bannerUrl,
      city: mapped.city,
      region: mapped.region,
      timezone: mapped.timezone,
      status: mapped.status,
      isOfficial: mapped.isOfficial,
      averageRating: mapped.averageRating,
      totalReviews: mapped.totalReviews,
      totalFollowers: mapped.totalFollowers,
      createdAt: mapped.createdAt,
      country: mapped.country
        ? { id: mapped.country.id, code: mapped.country.code, name: mapped.country.name }
        : null,
      seller: mapped.seller
        ? {
            status: mapped.seller.status,
            tradeName: mapped.seller.tradeName,
            averageRating: mapped.seller.averageRating,
            totalReviews: mapped.seller.totalReviews,
            totalSales: mapped.seller.totalSales,
          }
        : null,
    };
  }

  async createStore(userId: string, dto: CreateStoreDto, reqInfo: any) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (!seller || seller.status !== SellerStatus.VERIFIED) {
      throw new ForbiddenException('Apenas vendedores com status VERIFIED podem criar e ativar lojas.');
    }

    const existingSlug = await this.prisma.store.findUnique({
      where: { slug: dto.slug.toLowerCase() },
    });

    if (existingSlug) {
      throw new ConflictException('Slug da loja já está em uso.');
    }

    const country = await this.prisma.country.findUnique({
      where: { code: dto.countryCode.toUpperCase() },
    });

    if (!country) {
      throw new BadRequestException('País não encontrado.');
    }

    const store = await this.prisma.store.create({
      data: {
        sellerId: seller.id,
        countryId: country.id,
        name: dto.name,
        slug: dto.slug.toLowerCase(),
        description: dto.description,
        businessEmail: dto.businessEmail,
        businessPhone: dto.businessPhone,
        website: dto.website,
        addressLine1: dto.addressLine1,
        city: dto.city,
        region: dto.region,
        timezone: dto.timezone || 'UTC',
        status: StoreStatus.ACTIVE,
        members: {
          create: {
            userId,
            role: 'OWNER',
            status: 'ACTIVE',
          },
        },
      },
      include: { country: true, seller: true },
    });

    await this.redisService.del('cache:public:stores:all');

    await this.auditService.log({
      userId,
      action: 'STORE_CREATED',
      entity: 'Store',
      entityId: store.id,
      newValue: { name: store.name, slug: store.slug },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.mapStorePublicUrls(store);
  }

  async getMyStores(userId: string) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
    });

    if (!seller) return [];

    const stores = await this.prisma.store.findMany({
      where: { sellerId: seller.id, deletedAt: null },
      include: { country: true, members: true },
      orderBy: { createdAt: 'desc' },
    });

    return stores.map((s) => this.mapStorePublicUrls(s));
  }

  async getStoreById(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: { country: true, seller: true, members: { include: { user: true } } },
    });

    if (!store || store.deletedAt) {
      throw new NotFoundException('Loja não encontrada.');
    }

    return this.mapStorePublicUrls(store);
  }

  async getStoreBySlug(slug: string) {
    const store = await this.prisma.store.findFirst({
      where: { slug: slug.toLowerCase(), deletedAt: null },
      include: { country: true, seller: true },
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada.');
    }

    return this.mapStorePublicUrls(store);
  }

  async updateStore(userId: string, id: string, dto: UpdateStoreDto, reqInfo: any) {
    await this.storePermissionsService.validateStoreAccess(userId, id, 'MANAGE_TEAM');

    const updated = await this.prisma.store.update({
      where: { id },
      data: dto,
      include: { country: true },
    });

    await this.redisService.del('cache:public:stores:all');
    await this.redisService.del(`cache:public:store:${updated.slug}`);

    await this.auditService.log({
      userId,
      action: 'STORE_UPDATED',
      entity: 'Store',
      entityId: id,
      newValue: dto,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.mapStorePublicUrls(updated);
  }

  async deleteStore(userId: string, id: string, reqInfo: any) {
    await this.storePermissionsService.validateStoreAccess(userId, id, 'MANAGE_TEAM');

    await this.validateStoreClosingDependencies(id);

    const store = await this.prisma.store.update({
      where: { id },
      data: { deletedAt: new Date(), status: StoreStatus.CLOSED },
    });

    await this.redisService.del('cache:public:stores:all');
    await this.redisService.del(`cache:public:store:${store.slug}`);

    await this.auditService.log({
      userId,
      action: 'STORE_DELETED',
      entity: 'Store',
      entityId: id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Loja encerrada com sucesso.' };
  }

  async uploadLogo(userId: string, storeId: string, file: any, reqInfo: any) {
    await this.storePermissionsService.validateStoreAccess(userId, storeId, 'MANAGE_TEAM');
    this.validateImageFile(file);

    const currentStore = await this.prisma.store.findUnique({ where: { id: storeId } });

    const ext = file.originalname.split('.').pop() || 'png';
    const fileKey = `stores/${storeId}/logo-${uuidv4()}.${ext}`;

    const uploaded = await this.minioService.uploadFile(fileKey, file.buffer, file.mimetype, true);

    if (currentStore?.logoKey) {
      await this.minioService.deleteFile(currentStore.logoKey, true);
    }

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { logoKey: uploaded.key },
    });

    await this.redisService.del(`cache:public:store:${updated.slug}`);
    return this.mapStorePublicUrls(updated);
  }

  async uploadBanner(userId: string, storeId: string, file: any, reqInfo: any) {
    await this.storePermissionsService.validateStoreAccess(userId, storeId, 'MANAGE_TEAM');
    this.validateImageFile(file);

    const currentStore = await this.prisma.store.findUnique({ where: { id: storeId } });

    const ext = file.originalname.split('.').pop() || 'png';
    const fileKey = `stores/${storeId}/banner-${uuidv4()}.${ext}`;

    const uploaded = await this.minioService.uploadFile(fileKey, file.buffer, file.mimetype, true);

    if (currentStore?.bannerKey) {
      await this.minioService.deleteFile(currentStore.bannerKey, true);
    }

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { bannerKey: uploaded.key },
    });

    await this.redisService.del(`cache:public:store:${updated.slug}`);
    return this.mapStorePublicUrls(updated);
  }

  // Public Endpoints
  async listPublicStores(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { status: StoreStatus.ACTIVE, deletedAt: null };
    if (query.countryId) where.countryId = query.countryId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          country: true,
          seller: {
            select: {
              status: true,
              tradeName: true,
              averageRating: true,
              totalReviews: true,
              totalSales: true,
            },
          },
        },
      }),
      this.prisma.store.count({ where }),
    ]);

    const mappedItems = items.map((s) => this.mapPublicStore(s));
    return buildPaginatedResponse(mappedItems, total, page, limit);
  }

  async getPublicStoreBySlug(slug: string) {
    const cacheKey = `cache:public:store:${slug.toLowerCase()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const store = await this.prisma.store.findFirst({
      where: { slug: slug.toLowerCase(), status: StoreStatus.ACTIVE, deletedAt: null },
      include: {
        country: true,
        seller: {
          select: {
            status: true,
            tradeName: true,
            averageRating: true,
            totalReviews: true,
            totalSales: true,
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException('Loja pública não encontrada.');
    }

    const mapped = this.mapPublicStore(store);
    await this.redisService.set(cacheKey, JSON.stringify(mapped), 600);
    return mapped;
  }

  // Admin Endpoints
  async updateStoreStatus(adminUserId: string, storeId: string, status: StoreStatus, reqInfo: any) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { seller: true },
    });

    if (!store) {
      throw new NotFoundException('Loja não encontrada.');
    }

    if (status === StoreStatus.ACTIVE && store.seller.status !== SellerStatus.VERIFIED) {
      throw new BadRequestException('Não é possível ativar uma loja pertencente a um vendedor que não está VERIFIED.');
    }

    if (status === StoreStatus.CLOSED) {
      await this.validateStoreClosingDependencies(storeId);
    }

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: { status },
    });

    await this.redisService.del('cache:public:stores:all');
    await this.redisService.del(`cache:public:store:${store.slug}`);

    await this.auditService.log({
      userId: adminUserId,
      action: 'ADMIN_STORE_STATUS_UPDATED',
      entity: 'Store',
      entityId: storeId,
      newValue: { status },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.mapStorePublicUrls(updated);
  }

  private validateImageFile(file: any) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.');
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato de imagem inválido. Aceitamos apenas JPEG, PNG e WEBP.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Tamanho da imagem excede o limite de 5MB.');
    }
  }

  private async validateStoreClosingDependencies(storeId: string) {
    const activeProducts = await this.prisma.product.count({
      where: {
        storeId,
        status: { in: [ProductStatus.APPROVED, ProductStatus.PENDING_REVIEW] },
        deletedAt: null,
      },
    });

    if (activeProducts > 0) {
      throw new BadRequestException(`Impossível fechar a loja: Existem ${activeProducts} produtos com status APPROVED ou PENDING_REVIEW.`);
    }

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: {
        variant: { productId: { in: (await this.prisma.product.findMany({ where: { storeId }, select: { id: true } })).map((p) => p.id) } },
      },
    });

    const positiveStock = inventoryItems.some((i) => i.quantityAvailable > 0 || i.quantityReserved > 0);
    if (positiveStock) {
      throw new BadRequestException('Impossível fechar a loja: Existem itens com saldo de estoque disponível ou reservado.');
    }
  }
}
