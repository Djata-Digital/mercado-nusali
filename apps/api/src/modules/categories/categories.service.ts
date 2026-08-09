import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { CategoryStatus } from '@prisma/client';
import { buildPaginatedResponse } from '../../common/utils/pagination.util';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {}

  async createCategory(adminUserId: string, data: any, reqInfo: any) {
    const existingSlug = await this.prisma.category.findUnique({
      where: { slug: data.slug.toLowerCase() },
    });

    if (existingSlug) {
      throw new ConflictException('Slug de categoria já está em uso.');
    }

    if (data.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) throw new NotFoundException('Categoria pai não encontrada.');
    }

    const category = await this.prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug.toLowerCase(),
        description: data.description,
        iconKey: data.iconKey,
        imageKey: data.imageKey,
        sortOrder: data.sortOrder || 0,
        parentId: data.parentId || null,
        status: data.status || CategoryStatus.ACTIVE,
      },
      include: { parent: true },
    });

    await this.redisService.del('cache:public:categories:all');

    await this.auditService.log({
      userId: adminUserId,
      action: 'CATEGORY_CREATED',
      entity: 'Category',
      entityId: category.id,
      newValue: { name: category.name, slug: category.slug },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return category;
  }

  async listAdminCategories(query: any) {
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
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sortOrder: 'asc' },
        include: { parent: true, children: true },
      }),
      this.prisma.category.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { parent: true, children: true },
    });

    if (!category || category.deletedAt) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    return category;
  }

  async updateCategory(adminUserId: string, id: string, data: any, reqInfo: any) {
    const category = await this.getCategoryById(id);

    if (data.parentId) {
      if (data.parentId === id) {
        throw new BadRequestException('Uma categoria não pode ser pai de si mesma.');
      }
      await this.detectCycle(id, data.parentId);
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data,
      include: { parent: true },
    });

    await this.redisService.del('cache:public:categories:all');
    await this.redisService.del(`cache:public:category:${category.slug}`);

    await this.auditService.log({
      userId: adminUserId,
      action: 'CATEGORY_UPDATED',
      entity: 'Category',
      entityId: id,
      newValue: data,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async deleteCategory(adminUserId: string, id: string, reqInfo: any) {
    const category = await this.getCategoryById(id);

    const activeProductsCount = await this.prisma.product.count({
      where: { categoryId: id, status: 'APPROVED', deletedAt: null },
    });

    if (activeProductsCount > 0) {
      throw new BadRequestException(`Não é possível excluir categoria com ${activeProductsCount} produtos ativos associados.`);
    }

    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), status: CategoryStatus.ARCHIVED },
    });

    await this.redisService.del('cache:public:categories:all');
    await this.redisService.del(`cache:public:category:${category.slug}`);

    await this.auditService.log({
      userId: adminUserId,
      action: 'CATEGORY_DELETED',
      entity: 'Category',
      entityId: id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Categoria arquivada com sucesso.' };
  }

  // Public Endpoints
  async listPublicCategories() {
    const cacheKey = 'cache:public:categories:all';
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const categories = await this.prisma.category.findMany({
      where: { status: CategoryStatus.ACTIVE, parentId: null, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: {
          where: { status: CategoryStatus.ACTIVE, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    await this.redisService.set(cacheKey, JSON.stringify(categories), 600); // 10 min
    return categories;
  }

  async getPublicCategoryBySlug(slug: string) {
    const cacheKey = `cache:public:category:${slug.toLowerCase()}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const category = await this.prisma.category.findFirst({
      where: { slug: slug.toLowerCase(), status: CategoryStatus.ACTIVE, deletedAt: null },
      include: { parent: true, children: true },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    await this.redisService.set(cacheKey, JSON.stringify(category), 600);
    return category;
  }

  private async detectCycle(categoryId: string, proposedParentId: string) {
    let currentId: string | null = proposedParentId;
    while (currentId) {
      if (currentId === categoryId) {
        throw new BadRequestException('Ciclo de hierarquia detectado. A categoria pai proposta é uma subcategoria desta categoria.');
      }
      const parent: any = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = parent?.parentId || null;
    }
  }
}
