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
import { CategoriesService } from './categories.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Categories')
@Controller()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post('admin/categories')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN')
  @ApiOperation({ summary: 'Criar nova categoria (Admin)' })
  async createCategory(
    @CurrentUser('id') adminUserId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.categoriesService.createCategory(adminUserId, body, this.extractReqInfo(req));
  }

  @Get('admin/categories')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Listar todas as categorias (Admin)' })
  async listAdminCategories(@Query() query: any) {
    return this.categoriesService.listAdminCategories(query);
  }

  @Get('admin/categories/:id')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Obter detalhes de uma categoria por ID' })
  async getCategoryById(@Param('id') id: string) {
    return this.categoriesService.getCategoryById(id);
  }

  @Patch('admin/categories/:id')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN')
  @ApiOperation({ summary: 'Atualizar categoria (Admin)' })
  async updateCategory(
    @CurrentUser('id') adminUserId: string,
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.categoriesService.updateCategory(adminUserId, id, body, this.extractReqInfo(req));
  }

  @Delete('admin/categories/:id')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN')
  @ApiOperation({ summary: 'Arquivar categoria (Admin)' })
  async deleteCategory(
    @CurrentUser('id') adminUserId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.categoriesService.deleteCategory(adminUserId, id, this.extractReqInfo(req));
  }

  // Public Endpoints
  @Public()
  @Get('public/categories')
  @ApiOperation({ summary: 'Listagem pública de categorias ativas (Com Cache)' })
  async listPublicCategories() {
    return this.categoriesService.listPublicCategories();
  }

  @Public()
  @Get('public/categories/:slug')
  @ApiOperation({ summary: 'Obter categoria pública por Slug' })
  async getPublicCategoryBySlug(@Param('slug') slug: string) {
    return this.categoriesService.getPublicCategoryBySlug(slug);
  }
}
