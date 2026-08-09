import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post('products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar novo anúncio de produto (Rascunho)' })
  async createProduct(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProductDto,
    @Req() req: Request,
  ) {
    return this.productsService.createProduct(userId, dto, this.extractReqInfo(req));
  }

  @Get('products/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar produtos da loja do vendedor autenticado' })
  async getMyProducts(@CurrentUser('id') userId: string, @Query() query: any) {
    return this.productsService.getMyProducts(userId, query);
  }

  @Get('products/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter detalhes do produto por ID (privado)' })
  async getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }

  @Patch('products/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar dados do produto' })
  async updateProduct(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    return this.productsService.updateProduct(userId, id, dto, this.extractReqInfo(req));
  }

  @Delete('products/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Arquivar produto (Soft Delete)' })
  async deleteProduct(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.productsService.deleteProduct(userId, id, this.extractReqInfo(req));
  }

  @Post('products/:id/submit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submeter produto para revisão do admin' })
  async submitForReview(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.productsService.submitForReview(userId, id, this.extractReqInfo(req));
  }

  @Patch('products/:id/pause')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pausar anúncio do produto' })
  async pauseProduct(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.productsService.pauseProduct(userId, id, this.extractReqInfo(req));
  }

  @Patch('products/:id/activate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reativar anúncio do produto' })
  async activateProduct(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.productsService.activateProduct(userId, id, this.extractReqInfo(req));
  }

  // Admin Routes
  @Get('admin/products')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Listar produtos para moderação (Admin)' })
  async listAdminProducts(@Query() query: any) {
    return this.productsService.listAdminProducts(query);
  }

  @Patch('admin/products/:id/approve')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Aprovar anúncio de produto' })
  async approveProduct(
    @CurrentUser('id') adminUserId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.productsService.approveProduct(adminUserId, id, this.extractReqInfo(req));
  }

  @Patch('admin/products/:id/reject')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Rejeitar anúncio de produto com motivo' })
  async rejectProduct(
    @CurrentUser('id') adminUserId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: Request,
  ) {
    return this.productsService.rejectProduct(adminUserId, id, reason || 'Inconformidade com as regras do catálogo.', this.extractReqInfo(req));
  }

  // Public Routes
  @Public()
  @Get('public/products')
  @ApiOperation({ summary: 'Listagem pública de produtos aprovados' })
  async listPublicProducts(@Query() query: any) {
    return this.productsService.listPublicProducts(query);
  }

  @Public()
  @Get('public/products/:slug')
  @ApiOperation({ summary: 'Obter produto público por Slug (Com Cache)' })
  async getPublicProductBySlug(@Param('slug') slug: string) {
    return this.productsService.getPublicProductBySlug(slug);
  }
}
