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
import { BrandsService } from './brands.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Brands')
@Controller()
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post('admin/brands')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN')
  @ApiOperation({ summary: 'Criar nova marca (Admin)' })
  async createBrand(
    @CurrentUser('id') adminUserId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.brandsService.createBrand(adminUserId, body, this.extractReqInfo(req));
  }

  @Get('admin/brands')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Listar todas as marcas (Admin)' })
  async listAdminBrands(@Query() query: any) {
    return this.brandsService.listAdminBrands(query);
  }

  @Get('admin/brands/:id')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Obter detalhes da marca por ID' })
  async getBrandById(@Param('id') id: string) {
    return this.brandsService.getBrandById(id);
  }

  @Patch('admin/brands/:id')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN')
  @ApiOperation({ summary: 'Atualizar marca (Admin)' })
  async updateBrand(
    @CurrentUser('id') adminUserId: string,
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.brandsService.updateBrand(adminUserId, id, body, this.extractReqInfo(req));
  }

  @Delete('admin/brands/:id')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN')
  @ApiOperation({ summary: 'Desativar marca (Admin)' })
  async deleteBrand(
    @CurrentUser('id') adminUserId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.brandsService.deleteBrand(adminUserId, id, this.extractReqInfo(req));
  }

  // Public Routes
  @Public()
  @Get('public/brands')
  @ApiOperation({ summary: 'Listagem pública de marcas ativas (Com Cache)' })
  async listPublicBrands() {
    return this.brandsService.listPublicBrands();
  }

  @Public()
  @Get('public/brands/:slug')
  @ApiOperation({ summary: 'Obter marca pública por Slug' })
  async getPublicBrandBySlug(@Param('slug') slug: string) {
    return this.brandsService.getPublicBrandBySlug(slug);
  }
}
