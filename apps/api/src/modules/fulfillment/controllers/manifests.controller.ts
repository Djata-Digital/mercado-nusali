import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ManifestService } from '../services/manifest.service';
import { CreateShippingManifestDto, CloseManifestDto } from '../dto/manifest.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ManifestStatus } from '@prisma/client';

@ApiTags('Fulfillment - Romaneios (Manifests)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fulfillment/manifests')
export class ManifestsController {
  constructor(private readonly manifestService: ManifestService) {}

  @Post()
  @Permissions('manage_manifests', 'manage_shipping')
  @ApiOperation({ summary: 'Criar novo romaneio de expedição para lote de cargas' })
  async createManifest(@Body() dto: CreateShippingManifestDto, @Request() req: any) {
    return this.manifestService.createManifest(dto, req.user.id, req.user);
  }

  @Get()
  @Permissions('manage_manifests', 'shipping:read')
  @ApiOperation({ summary: 'Listar romaneios de expedição' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ManifestStatus })
  async listManifests(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: ManifestStatus,
  ) {
    return this.manifestService.listManifests(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      warehouseId,
      status,
      req.user,
    );
  }

  @Get(':id')
  @Permissions('manage_manifests', 'shipping:read')
  @ApiOperation({ summary: 'Obter detalhes do romaneio' })
  async getManifestById(@Param('id') id: string, @Request() req: any) {
    return this.manifestService.getManifestById(id, req.user);
  }

  @Post(':id/close')
  @Permissions('manage_manifests', 'manage_shipping')
  @ApiOperation({ summary: 'Fechar romaneio de expedição' })
  async closeManifest(@Param('id') id: string, @Body() dto: CloseManifestDto, @Request() req: any) {
    return this.manifestService.closeManifest(id, dto, req.user.id, req.user);
  }

  @Post(':id/dispatch')
  @Permissions('manage_manifests', 'manage_shipping')
  @ApiOperation({ summary: 'Despachar romaneio e marcar todos os envios contidos como DISPATCHED' })
  async dispatchManifest(@Param('id') id: string, @Request() req: any) {
    return this.manifestService.dispatchManifest(id, req.user.id, req.user);
  }
}
