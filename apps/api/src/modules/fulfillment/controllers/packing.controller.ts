import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PackingService } from '../services/packing.service';
import { LabelService } from '../services/label.service';
import {
  CreatePackingMaterialDto,
  StartPackingDto,
  CompletePackingDto,
  CancelPackingOrderDto,
} from '../dto/packing.dto';
import { GenerateLabelDto } from '../dto/shipping.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PackingOrderStatus, PackingMaterialType, PackingMaterialStatus } from '@prisma/client';

@ApiTags('Fulfillment - Packing (Embalagem & Conferência)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fulfillment/packing')
export class PackingController {
  constructor(
    private readonly packingService: PackingService,
    private readonly labelService: LabelService,
  ) {}

  @Post('materials')
  @Permissions('manage_packing', 'packing:manage')
  @ApiOperation({ summary: 'Cadastrar nova embalagem no catálogo' })
  async createMaterial(@Body() dto: CreatePackingMaterialDto) {
    return this.packingService.createMaterial(dto);
  }

  @Get('materials')
  @Permissions('packing:read', 'manage_packing')
  @ApiOperation({ summary: 'Listar catálogo de embalagens disponíveis' })
  @ApiQuery({ name: 'type', required: false, enum: PackingMaterialType })
  @ApiQuery({ name: 'status', required: false, enum: PackingMaterialStatus })
  async listMaterials(
    @Query('type') type?: PackingMaterialType,
    @Query('status') status?: PackingMaterialStatus,
  ) {
    return this.packingService.listMaterials(type, status);
  }

  @Post('start')
  @Permissions('manage_packing', 'packing:manage')
  @ApiOperation({ summary: 'Iniciar processo de embalagem para Ordem de Picking concluída' })
  async startPacking(@Body() dto: StartPackingDto, @Request() req: any) {
    return this.packingService.startPacking(dto, req.user.id, req.user);
  }

  @Get()
  @Permissions('packing:read', 'manage_packing')
  @ApiOperation({ summary: 'Listar Ordens de Embalagem (Packing Orders)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: PackingOrderStatus })
  async listPackingOrders(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: PackingOrderStatus,
  ) {
    return this.packingService.listPackingOrders(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      warehouseId,
      status,
      req.user,
    );
  }

  @Get(':id')
  @Permissions('packing:read', 'manage_packing')
  @ApiOperation({ summary: 'Obter detalhes da Ordem de Embalagem' })
  async getPackingOrderById(@Param('id') id: string, @Request() req: any) {
    return this.packingService.getPackingOrderById(id, req.user);
  }

  @Post(':id/complete')
  @Permissions('manage_packing', 'packing:manage')
  @ApiOperation({ summary: 'Concluir embalagem (pesagem, medição, lacre)' })
  async completePacking(@Param('id') id: string, @Body() dto: CompletePackingDto, @Request() req: any) {
    return this.packingService.completePacking(id, dto, req.user.id, req.user);
  }

  @Post(':id/label')
  @Permissions('print_labels', 'manage_packing')
  @ApiOperation({ summary: 'Gerar etiqueta de envio (Shipping Label) com QR Code e Código de Barras' })
  async generateLabel(@Param('id') id: string, @Body() dto: GenerateLabelDto, @Request() req: any) {
    return this.labelService.generateLabel({ ...dto, packingOrderId: id }, req.user.id, req.user);
  }

  @Post(':id/cancel')
  @Permissions('manage_packing', 'packing:manage')
  @ApiOperation({ summary: 'Cancelar Ordem de Embalagem' })
  async cancelPacking(@Param('id') id: string, @Body() dto: CancelPackingOrderDto, @Request() req: any) {
    return this.packingService.cancelPacking(id, dto, req.user.id, req.user);
  }

  @Post(':id/reopen')
  @Permissions('manage_packing', 'packing:manage')
  @ApiOperation({ summary: 'Reabrir Ordem de Embalagem para nova conferência' })
  async reopenPacking(@Param('id') id: string, @Body('reason') reason: string, @Request() req: any) {
    return this.packingService.reopenPacking(id, reason, req.user.id, req.user);
  }
}
