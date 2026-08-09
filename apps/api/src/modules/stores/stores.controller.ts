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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StoreStatus } from '@prisma/client';

@ApiTags('Stores')
@Controller()
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post('stores')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar nova loja para o vendedor autenticado' })
  async createStore(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateStoreDto,
    @Req() req: Request,
  ) {
    return this.storesService.createStore(userId, dto, this.extractReqInfo(req));
  }

  @Get('stores/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar lojas do vendedor autenticado' })
  async getMyStores(@CurrentUser('id') userId: string) {
    return this.storesService.getMyStores(userId);
  }

  @Get('stores/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter detalhes da loja por ID' })
  async getStoreById(@Param('id') id: string) {
    return this.storesService.getStoreById(id);
  }

  @Get('stores/slug/:slug')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter detalhes da loja por Slug (privado)' })
  async getStoreBySlug(@Param('slug') slug: string) {
    return this.storesService.getStoreBySlug(slug);
  }

  @Patch('stores/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar dados da loja' })
  async updateStore(
    @CurrentUser('id') userId: string,
    @Param('id') storeId: string,
    @Body() dto: UpdateStoreDto,
    @Req() req: Request,
  ) {
    return this.storesService.updateStore(userId, storeId, dto, this.extractReqInfo(req));
  }

  @Delete('stores/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover loja (Soft Delete)' })
  async deleteStore(
    @CurrentUser('id') userId: string,
    @Param('id') storeId: string,
    @Req() req: Request,
  ) {
    return this.storesService.deleteStore(userId, storeId, this.extractReqInfo(req));
  }

  @Post('stores/:id/logo')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de logotipo da loja (Público)' })
  async uploadLogo(
    @CurrentUser('id') userId: string,
    @Param('id') storeId: string,
    @UploadedFile() file: any,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    return this.storesService.uploadLogo(userId, storeId, file, this.extractReqInfo(req));
  }

  @Post('stores/:id/banner')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de banner da loja (Público)' })
  async uploadBanner(
    @CurrentUser('id') userId: string,
    @Param('id') storeId: string,
    @UploadedFile() file: any,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    return this.storesService.uploadBanner(userId, storeId, file, this.extractReqInfo(req));
  }

  // Public Routes
  @Public()
  @Get('public/stores')
  @ApiOperation({ summary: 'Listagem pública de lojas ativas' })
  async listPublicStores(@Query() query: any) {
    return this.storesService.listPublicStores(query);
  }

  @Public()
  @Get('public/stores/:slug')
  @ApiOperation({ summary: 'Obter loja pública por Slug' })
  async getPublicStoreBySlug(@Param('slug') slug: string) {
    return this.storesService.getPublicStoreBySlug(slug);
  }

  // Admin Routes
  @Patch('admin/stores/:id/status')
  @ApiBearerAuth()
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'MODERATOR')
  @ApiOperation({ summary: 'Atualizar status da loja (Admin/Moderador)' })
  async updateStoreStatus(
    @CurrentUser('id') adminUserId: string,
    @Param('id') storeId: string,
    @Body('status') status: StoreStatus,
    @Req() req: Request,
  ) {
    return this.storesService.updateStoreStatus(adminUserId, storeId, status, this.extractReqInfo(req));
  }
}
