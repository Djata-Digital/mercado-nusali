import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../storage/minio.service';
import { AuditService } from '../audit/audit.service';
import { StorePermissionsService } from '../../common/services/store-permissions.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProductImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly auditService: AuditService,
    private readonly storePermissionsService: StorePermissionsService,
  ) {}

  private mapImagePublicUrl(img: any) {
    if (!img) return img;
    const url = img.fileKey ? this.minioService.getPublicUrl(img.fileKey) : null;
    return {
      ...img,
      url,
    };
  }

  async uploadImage(
    userId: string,
    productId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
    reqInfo: any,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });

    if (!product || product.deletedAt) {
      throw new NotFoundException('Produto não encontrado.');
    }

    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    if (product.images.length >= 10) {
      throw new BadRequestException('Limite máximo de 10 imagens por produto atingido.');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de imagem inválido. Aceito apenas JPG, PNG e WEBP.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Tamanho máximo de imagem excede o limite de 5MB.');
    }

    const ext = file.originalname.split('.').pop() || 'png';
    const fileKey = `products/${product.id}/img-${uuidv4()}.${ext}`;

    const uploaded = await this.minioService.uploadFile(fileKey, file.buffer, file.mimetype, true);

    const isFirstImage = product.images.length === 0;

    const image = await this.prisma.productImage.create({
      data: {
        productId,
        fileKey: uploaded.key,
        bucket: uploaded.bucket,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        position: product.images.length + 1,
        isMain: isFirstImage,
      },
    });

    await this.auditService.log({
      userId,
      action: 'PRODUCT_IMAGE_UPLOADED',
      entity: 'ProductImage',
      entityId: image.id,
      newValue: { fileName: file.originalname, isMain: image.isMain },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.mapImagePublicUrl(image);
  }

  async getImages(productId: string) {
    const images = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
    });
    return images.map((img) => this.mapImagePublicUrl(img));
  }

  async setMainImage(userId: string, productId: string, imageId: string, reqInfo: any) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) throw new NotFoundException('Produto não encontrado.');
    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    const images = await this.prisma.productImage.findMany({ where: { productId } });
    const target = images.find((img) => img.id === imageId);

    if (!target) {
      throw new NotFoundException('Imagem não encontrada para este produto.');
    }

    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({
        where: { productId },
        data: { isMain: false },
      }),
      this.prisma.productImage.update({
        where: { id: imageId },
        data: { isMain: true },
      }),
    ]);

    await this.auditService.log({
      userId,
      action: 'PRODUCT_MAIN_IMAGE_SET',
      entity: 'ProductImage',
      entityId: imageId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Imagem principal definida com sucesso.' };
  }

  async reorderImages(userId: string, productId: string, imageIdsInOrder: string[], reqInfo: any) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) throw new NotFoundException('Produto não encontrado.');
    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    const existingImages = await this.prisma.productImage.findMany({ where: { productId } });
    const existingIds = new Set(existingImages.map((img) => img.id));

    if (imageIdsInOrder.length !== existingImages.length || !imageIdsInOrder.every((id) => existingIds.has(id))) {
      throw new BadRequestException('A lista de IDs de imagem para reordenação é inválida ou contém imagens que não pertencem a este produto.');
    }

    await this.prisma.$transaction(
      imageIdsInOrder.map((id, index) =>
        this.prisma.productImage.update({
          where: { id },
          data: { position: index + 1 },
        }),
      ),
    );

    return this.getImages(productId);
  }

  async deleteImage(userId: string, productId: string, imageId: string, reqInfo: any) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt) throw new NotFoundException('Produto não encontrado.');
    await this.storePermissionsService.validateStoreAccess(userId, product.storeId, 'MANAGE_PRODUCTS');

    const images = await this.prisma.productImage.findMany({ where: { productId } });
    const target = images.find((img) => img.id === imageId);

    if (!target) {
      throw new NotFoundException('Imagem não encontrada.');
    }

    await this.prisma.productImage.delete({
      where: { id: imageId },
    });

    if (target.fileKey) {
      await this.minioService.deleteFile(target.fileKey, true);
    }

    // If main image deleted, promote next image transactionally
    if (target.isMain && images.length > 1) {
      const nextImage = images.find((img) => img.id !== imageId);
      if (nextImage) {
        await this.prisma.productImage.update({
          where: { id: nextImage.id },
          data: { isMain: true },
        });
      }
    }

    await this.auditService.log({
      userId,
      action: 'PRODUCT_IMAGE_DELETED',
      entity: 'ProductImage',
      entityId: imageId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return { message: 'Imagem removida com sucesso.' };
  }
}
