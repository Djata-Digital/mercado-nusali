import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ProductImagesService } from './product-images.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Product Images')
@Controller('products/:productId/images')
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post()
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Fazer upload de imagem do produto' })
  async uploadImage(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @UploadedFile() file: any,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Arquivo de imagem não enviado.');
    return this.productImagesService.uploadImage(userId, productId, file, this.extractReqInfo(req));
  }

  @Get()
  @ApiOperation({ summary: 'Listar imagens de um produto' })
  async getImages(@Param('productId') productId: string) {
    return this.productImagesService.getImages(productId);
  }

  @Patch(':imageId/main')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Definir imagem como principal' })
  async setMainImage(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Req() req: Request,
  ) {
    return this.productImagesService.setMainImage(userId, productId, imageId, this.extractReqInfo(req));
  }

  @Patch('reorder')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reordenar exibição das imagens do produto' })
  async reorderImages(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Body('imageIds') imageIds: string[],
    @Req() req: Request,
  ) {
    return this.productImagesService.reorderImages(userId, productId, imageIds || [], this.extractReqInfo(req));
  }

  @Delete(':imageId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover imagem do produto' })
  async deleteImage(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @Req() req: Request,
  ) {
    return this.productImagesService.deleteImage(userId, productId, imageId, this.extractReqInfo(req));
  }
}
