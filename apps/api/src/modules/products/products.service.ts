import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { StorePermissionsService } from '../../common/services/store-permissions.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductStatus, StoreStatus, SellerStatus, SaleScope } from '@prisma/client';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';
import { MinioService } from '../storage/minio.service';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
    private readonly storePermissionsService: StorePermissionsService,
    private readonly minioService: MinioService,
  ) {}

  private mapPublicProduct(product: any) {
    return {
      ...product,
      images: (product.images || []).map((image: any) => ({ ...image, url: image.fileKey && typeof (this.minioService as any)?.getPublicUrl === 'function' ? this.minioService.getPublicUrl(image.fileKey) : (image.url || null) })),
      variants: (product.variants || []).map((variant: any) => ({
        ...variant,
        stock: (variant.inventoryItems || []).reduce((sum: number, item: any) => sum + Math.max(0, item.quantityAvailable || 0), 0),
        inventoryItems: undefined,
      })),
    };
  }

  async createProduct(userId: string, dto: CreateProductDto, reqInfo: any) {
    await this.storePermissionsService.validateStoreAccess(userId, dto.storeId, 'MANAGE_PRODUCTS');

    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
      include: { seller: true },
    });

    if (!store || store.deletedAt) {
      throw new NotFoundException('Loja não encontrada.');
    }

    if (store.seller.status !== SellerStatus.VERIFIED) {
      throw new BadRequestException('Vendedor não verificado não pode cadastrar produtos.');
    }

    if (store.status !== StoreStatus.ACTIVE) {
      throw new BadRequestException('A loja precisa estar ATIVA para cadastrar produtos.');
    }

    const existingSlug = await this.prisma.product.findUnique({
      where: { slug: dto.slug.toLowerCase() },
    });

    if (existingSlug) {
      throw new ConflictException('Slug do produto já está em uso por outro anúncio.');
    }

    let countryOfOriginId: string | undefined = undefined;
    if (dto.countryOfOriginCode) {
      const country = await this.prisma.country.findUnique({
        where: { code: dto.countryOfOriginCode.toUpperCase() },
      });
      if (!country) {
        throw new BadRequestException('País de origem informado não existe.');
      }
      countryOfOriginId = country.id;
    }

    if (([SaleScope.INTERNATIONAL, SaleScope.BOTH] as SaleScope[]).includes(dto.saleScope) && !countryOfOriginId) {
      throw new BadRequestException('Produtos com escopo internacional ou híbrido (BOTH/INTERNATIONAL) devem possuir país de origem válido especificado.');
    }

    const product = await this.prisma.product.create({
      data: {
        storeId: dto.storeId,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        title: dto.title,
        slug: dto.slug.toLowerCase(),
        description: dto.description,
        condition: dto.condition,
        productType: dto.productType,
        saleScope: dto.saleScope,
        saleType: dto.saleType,
        countryOfOriginId,
        weight: dto.weight,
        status: ProductStatus.DRAFT,
      },
      include: { store: true, category: true, brand: true },
    });

    await this.auditService.log({
      userId,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: product.id,
      newValue: { title: product.title, slug: product.slug },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return product;
  }

  async getMyProducts(userId: string, query: any) {
    const seller = await this.prisma.sellerProfile.findUnique({
      where: { userId },
      include: { stores: true },
    });

    if (!seller) return buildPaginatedResponse([], 0);

    const storeIds = seller.stores.map((s) => s.id);
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { storeId: { in: storeIds }, deletedAt: null };
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { store: true, category: true, images: true, variants: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        store: true,
        category: true,
        brand: true,
        countryOfOrigin: true,
        images: { orderBy: { position: 'asc' } },
        variants: { where: { deletedAt: null } },
      },
    });

    if (!product || product.deletedAt) {
      throw new NotFoundException('Produto não encontrado.');
    }

    return product;
  }

  async updateProduct(userId: string, id: string, dto: UpdateProductDto, reqInfo: any) {
    const product = await this.getProductById(id);
    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    const updateData: any = { ...dto };

    if (dto.countryOfOriginCode) {
      const country = await this.prisma.country.findUnique({
        where: { code: dto.countryOfOriginCode.toUpperCase() },
      });
      if (!country) {
        throw new BadRequestException('País de origem informado não existe.');
      }
      updateData.countryOfOriginId = country.id;
      delete updateData.countryOfOriginCode;
    }

    const effectiveScope = dto.saleScope || product.saleScope;
    const effectiveCountryId = updateData.countryOfOriginId || product.countryOfOriginId;

    if (([SaleScope.INTERNATIONAL, SaleScope.BOTH] as SaleScope[]).includes(effectiveScope) && !effectiveCountryId) {
      throw new BadRequestException('Produtos com escopo internacional ou híbrido (BOTH/INTERNATIONAL) devem possuir país de origem válido especificado.');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: { store: true, category: true, images: true, variants: true },
    });

    await this.redisService.del(`cache:public:product:${product.slug}`);

    await this.auditService.log({
      userId,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: id,
      newValue: updateData,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async deleteProduct(userId: string, id: string, reqInfo: any) {
    const product = await this.getProductById(id);
    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProductStatus.ARCHIVED },
    });

    await this.redisService.del(`cache:public:product:${product.slug}`);

    await this.auditService.log({
      userId,
      action: 'PRODUCT_DELETED',
      entity: 'Product',
      entityId: id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Produto removido com sucesso.' };
  }

  async submitForReview(userId: string, id: string, reqInfo: any) {
    const product = await this.getProductById(id);
    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    if (product.variants.length === 0) {
      throw new BadRequestException('O produto precisa ter pelo menos uma variante cadastrada antes da submissão.');
    }

    // Strict main image check: image.isMain === true
    const hasMainImage = product.images.some((img) => img.isMain);
    if (!hasMainImage) {
      throw new BadRequestException('O produto precisa obrigatoriamente ter uma imagem definida como principal (isMain: true) antes da submissão.');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.PENDING_REVIEW },
    });

    await this.auditService.log({
      userId,
      action: 'PRODUCT_SUBMITTED',
      entity: 'Product',
      entityId: id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async pauseProduct(userId: string, id: string, reqInfo: any) {
    const product = await this.getProductById(id);
    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    if (product.status !== ProductStatus.APPROVED) {
      throw new BadRequestException('Apenas produtos aprovados (APPROVED) podem ser pausados.');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.PAUSED },
    });

    await this.redisService.del(`cache:public:product:${product.slug}`);
    return updated;
  }

  async activateProduct(userId: string, id: string, reqInfo: any) {
    const product = await this.getProductById(id);
    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    // Requirement 11: Seller can activate ONLY products that were previously APPROVED and currently PAUSED!
    if (product.status !== ProductStatus.PAUSED) {
      throw new BadRequestException('Não é permitido publicar ou ativar um produto que esteja em DRAFT, PENDING_REVIEW ou REJECTED por este endpoint. Apenas produtos pausados previamente aprovados podem ser reativados.');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.APPROVED },
    });

    await this.redisService.del(`cache:public:product:${product.slug}`);
    return updated;
  }

  // Admin Endpoints
  async listAdminProducts(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.storeId) where.storeId = query.storeId;
    if (query.categoryId) where.categoryId = query.categoryId;

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { store: true, category: true, images: true, variants: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async approveProduct(adminUserId: string, id: string, reqInfo: any) {
    const product = await this.getProductById(id);

    if (product.variants.length === 0) {
      throw new BadRequestException('Não é possível aprovar um produto sem variantes cadastradas.');
    }

    // Strict main image check
    const hasMainImage = product.images.some((img) => img.isMain);
    if (!hasMainImage) {
      throw new BadRequestException('Não é possível aprovar um produto sem uma imagem marcada estritamente como principal (isMain: true).');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.APPROVED },
    });

    await this.redisService.del(`cache:public:product:${product.slug}`);

    await this.auditService.log({
      userId: adminUserId,
      action: 'PRODUCT_APPROVED',
      entity: 'Product',
      entityId: id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async rejectProduct(adminUserId: string, id: string, reason: string, reqInfo: any) {
    const product = await this.getProductById(id);

    const updated = await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.REJECTED },
    });

    await this.redisService.del(`cache:public:product:${product.slug}`);

    await this.auditService.log({
      userId: adminUserId,
      action: 'PRODUCT_REJECTED',
      entity: 'Product',
      entityId: id,
      newValue: { reason },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  // Public Endpoints
  async listPublicProducts(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { status: ProductStatus.APPROVED, deletedAt: null };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.storeId) where.storeId = query.storeId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          store: { include: { country: true } },
          category: true,
          brand: true,
          countryOfOrigin: true,
          images: { orderBy: { position: 'asc' } },
          variants: { where: { deletedAt: null }, include: { currency: true, inventoryItems: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResponse(items.map((item) => this.mapPublicProduct(item)), total, page, limit);
  }

  async getPublicProductBySlug(slug: string) {
    const cacheKey = `cache:public:product:${slug.toLowerCase()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const product = await this.prisma.product.findFirst({
      where: { slug: slug.toLowerCase(), status: ProductStatus.APPROVED, deletedAt: null },
      include: {
        store: { include: { country: true } },
        category: true,
        brand: true,
        countryOfOrigin: true,
        images: { orderBy: { position: 'asc' } },
        variants: { where: { deletedAt: null }, include: { currency: true, inventoryItems: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    const publicProduct = this.mapPublicProduct(product);
    await this.redisService.set(cacheKey, JSON.stringify(publicProduct), 300); // 5 min
    return publicProduct;
  }
}
