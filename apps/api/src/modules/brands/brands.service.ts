import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { BrandStatus } from '@prisma/client';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async createBrand(adminUserId: string, data: any, reqInfo: any) {
    const existingSlug = await this.prisma.brand.findUnique({
      where: { slug: data.slug.toLowerCase() },
    });

    if (existingSlug) {
      throw new ConflictException('Slug de marca já está em uso.');
    }

    const brand = await this.prisma.brand.create({
      data: {
        name: data.name,
        slug: data.slug.toLowerCase(),
        description: data.description,
        logoKey: data.logoKey,
        countryId: data.countryId,
        isVerified: data.isVerified || false,
        status: data.status || BrandStatus.ACTIVE,
      },
      include: { country: true },
    });

    await this.redisService.del('cache:public:brands:all');

    await this.auditService.log({
      userId: adminUserId,
      action: 'BRAND_CREATED',
      entity: 'Brand',
      entityId: brand.id,
      newValue: { name: brand.name, slug: brand.slug },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return brand;
  }

  async listAdminBrands(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { country: true },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getBrandById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { country: true },
    });

    if (!brand || brand.deletedAt) {
      throw new NotFoundException('Marca não encontrada.');
    }

    return brand;
  }

  async updateBrand(adminUserId: string, id: string, data: any, reqInfo: any) {
    const brand = await this.getBrandById(id);

    const updated = await this.prisma.brand.update({
      where: { id },
      data,
      include: { country: true },
    });

    await this.redisService.del('cache:public:brands:all');
    await this.redisService.del(`cache:public:brand:${brand.slug}`);

    await this.auditService.log({
      userId: adminUserId,
      action: 'BRAND_UPDATED',
      entity: 'Brand',
      entityId: id,
      newValue: data,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async deleteBrand(adminUserId: string, id: string, reqInfo: any) {
    const brand = await this.getBrandById(id);

    await this.prisma.brand.update({
      where: { id },
      data: { deletedAt: new Date(), status: BrandStatus.SUSPENDED },
    });

    await this.redisService.del('cache:public:brands:all');
    await this.redisService.del(`cache:public:brand:${brand.slug}`);

    await this.auditService.log({
      userId: adminUserId,
      action: 'BRAND_DELETED',
      entity: 'Brand',
      entityId: id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Marca desativada com sucesso.' };
  }

  // Public Endpoints
  async listPublicBrands() {
    const cacheKey = 'cache:public:brands:all';
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const brands = await this.prisma.brand.findMany({
      where: { status: BrandStatus.ACTIVE, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { country: true },
    });

    await this.redisService.set(cacheKey, JSON.stringify(brands), 600); // 10 min
    return brands;
  }

  async getPublicBrandBySlug(slug: string) {
    const cacheKey = `cache:public:brand:${slug.toLowerCase()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const brand = await this.prisma.brand.findFirst({
      where: { slug: slug.toLowerCase(), status: BrandStatus.ACTIVE, deletedAt: null },
      include: { country: true },
    });

    if (!brand) {
      throw new NotFoundException('Marca não encontrada.');
    }

    await this.redisService.set(cacheKey, JSON.stringify(brand), 600);
    return brand;
  }
}
