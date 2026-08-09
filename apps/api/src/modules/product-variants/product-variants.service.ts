import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorePermissionsService } from '../../common/services/store-permissions.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { ProductVariantStatus } from '@prisma/client';

@Injectable()
export class ProductVariantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storePermissionsService: StorePermissionsService,
  ) {}

  async createVariant(userId: string, productId: string, dto: CreateProductVariantDto, reqInfo: any) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.deletedAt) {
      throw new NotFoundException('Produto não encontrado.');
    }

    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    const existingSku = await this.prisma.productVariant.findUnique({
      where: { sku: dto.sku.toUpperCase() },
    });

    if (existingSku) {
      throw new ConflictException('SKU já cadastrado na plataforma.');
    }

    if (dto.price <= 0) {
      throw new BadRequestException('O preço da variante deve ser positivo.');
    }

    if (dto.promotionalPrice !== undefined && dto.promotionalPrice > dto.price) {
      throw new BadRequestException('O preço promocional não pode ser superior ao preço normal.');
    }

    if (dto.wholesalePrice !== undefined && (!dto.minimumWholesaleQuantity || dto.minimumWholesaleQuantity <= 0)) {
      throw new BadRequestException('A quantidade mínima de atacado é obrigatória quando houver preço de atacado.');
    }

    const currency = await this.prisma.currency.findUnique({
      where: { code: dto.currencyCode.toUpperCase() },
    });

    if (!currency) {
      throw new BadRequestException('Moeda não encontrada.');
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku.toUpperCase(),
        name: dto.name,
        price: dto.price,
        promotionalPrice: dto.promotionalPrice,
        wholesalePrice: dto.wholesalePrice,
        minimumWholesaleQuantity: dto.minimumWholesaleQuantity,
        currencyId: currency.id,
        barcode: dto.barcode,
        attributesJson: dto.attributesJson,
        status: ProductVariantStatus.ACTIVE,
      },
      include: { currency: true },
    });

    await this.auditService.log({
      userId,
      action: 'PRODUCT_VARIANT_CREATED',
      entity: 'ProductVariant',
      entityId: variant.id,
      newValue: { sku: variant.sku, price: variant.price },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return variant;
  }

  async getVariantsByProduct(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
      include: { currency: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getVariantById(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { product: true, currency: true },
    });

    if (!variant || variant.deletedAt) {
      throw new NotFoundException('Variante de produto não encontrada.');
    }

    return variant;
  }

  async updateVariant(userId: string, id: string, data: any, reqInfo: any) {
    const variant = await this.getVariantById(id);
    await this.storePermissionsService.validateStoreAccess(userId, variant.product.storeId, 'MANAGE_PRODUCTS');

    if (data.price !== undefined && data.price <= 0) {
      throw new BadRequestException('O preço deve ser positivo.');
    }

    const targetPrice = data.price !== undefined ? data.price : Number(variant.price);
    if (data.promotionalPrice !== undefined && data.promotionalPrice > targetPrice) {
      throw new BadRequestException('O preço promocional não pode ser superior ao preço normal.');
    }

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data,
      include: { currency: true },
    });

    await this.auditService.log({
      userId,
      action: 'PRODUCT_VARIANT_UPDATED',
      entity: 'ProductVariant',
      entityId: id,
      previousValue: { price: variant.price },
      newValue: data,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }

  async deleteVariant(userId: string, id: string, reqInfo: any) {
    const variant = await this.getVariantById(id);
    await this.storePermissionsService.validateStoreAccess(userId, variant.product.storeId, 'MANAGE_PRODUCTS');

    await this.prisma.productVariant.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProductVariantStatus.ARCHIVED },
    });

    await this.auditService.log({
      userId,
      action: 'PRODUCT_VARIANT_DELETED',
      entity: 'ProductVariant',
      entityId: id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Variante arquivada com sucesso.' };
  }
}
