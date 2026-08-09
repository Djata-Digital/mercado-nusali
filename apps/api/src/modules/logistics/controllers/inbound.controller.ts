import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InboundService } from '../services/inbound.service';
import { CreateInboundShipmentDto, InspectInboundItemDto } from '../dto/inbound.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { InboundShipmentStatus } from '@prisma/client';

@ApiTags('Recebimento & Inspeção Logística')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('logistics/inbound')
export class InboundController {
  constructor(private readonly inboundService: InboundService) {}

  @Post()
  @Permissions('inbound:create', 'hub:manage')
  @ApiOperation({ summary: 'Criar ordem de recebimento (Inbound Shipment)' })
  async createShipment(@Body() dto: CreateInboundShipmentDto, @Request() req: any) {
    return this.inboundService.createShipment(dto, req.user.id);
  }

  @Get()
  @Permissions('inbound:read')
  @ApiOperation({ summary: 'Listar ordens de recebimento' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: InboundShipmentStatus })
  async listShipments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: InboundShipmentStatus,
  ) {
    return this.inboundService.listShipments(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      warehouseId,
      status,
    );
  }

  @Get(':id')
  @Permissions('inbound:read')
  @ApiOperation({ summary: 'Obter detalhes da ordem de recebimento' })
  async getShipmentById(@Param('id') id: string) {
    return this.inboundService.getShipmentById(id);
  }

  @Post(':id/transit')
  @Permissions('inbound:create', 'hub:manage')
  @ApiOperation({ summary: 'Marcar ordem de recebimento como em trânsito' })
  async markInTransit(@Param('id') id: string, @Request() req: any) {
    return this.inboundService.markInTransit(id, req.user.id);
  }

  @Post(':id/receive')
  @Permissions('inbound:inspect', 'hub:manage')
  @ApiOperation({ summary: 'Registrar chegada e recebimento da carga no HUB' })
  async receiveShipment(@Param('id') id: string, @Request() req: any) {
    return this.inboundService.receiveShipment(id, req.user.id);
  }

  @Post(':id/inspect')
  @Permissions('inbound:inspect', 'hub:manage')
  @ApiOperation({ summary: 'Registrar conferência física/qualidade de item da carga' })
  async inspectItem(@Param('id') id: string, @Body() dto: InspectInboundItemDto, @Request() req: any) {
    return this.inboundService.inspectItem(id, dto, req.user.id);
  }

  @Post(':id/store')
  @Permissions('inbound:store', 'hub:manage')
  @ApiOperation({ summary: 'Endereçar e armazenar carga inspecionada no estoque do HUB' })
  async storeShipment(@Param('id') id: string, @Request() req: any) {
    return this.inboundService.storeShipment(id, req.user.id);
  }
}
