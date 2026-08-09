import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductVariantsService } from './product-variants.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Product Variants')
@ApiBearerAuth()
@Controller()
export class ProductVariantsController {
  constructor(private readonly productVariantsService: ProductVariantsService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post('products/:productId/variants')
  @ApiOperation({ summary: 'Criar nova variante de produto' })
  async createVariant(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateProductVariantDto,
    @Req() req: Request,
  ) {
    return this.productVariantsService.createVariant(userId, productId, dto, this.extractReqInfo(req));
  }

  @Get('products/:productId/variants')
  @ApiOperation({ summary: 'Listar variantes de um produto' })
  async getVariantsByProduct(@Param('productId') productId: string) {
    return this.productVariantsService.getVariantsByProduct(productId);
  }

  @Get('product-variants/:id')
  @ApiOperation({ summary: 'Obter detalhes de variante por ID' })
  async getVariantById(@Param('id') id: string) {
    return this.productVariantsService.getVariantById(id);
  }

  @Patch('product-variants/:id')
  @ApiOperation({ summary: 'Atualizar variante de produto' })
  async updateVariant(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.productVariantsService.updateVariant(userId, id, body, this.extractReqInfo(req));
  }

  @Delete('product-variants/:id')
  @ApiOperation({ summary: 'Remover (arquivar) variante de produto' })
  async deleteVariant(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.productVariantsService.deleteVariant(userId, id, this.extractReqInfo(req));
  }
}
