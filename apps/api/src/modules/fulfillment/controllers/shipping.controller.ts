import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ShippingService } from '../services/shipping.service';
import { LabelService } from '../services/label.service';
import { CreateShipmentDto, DispatchShipmentDto, CancelShipmentDto } from '../dto/shipping.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ShipmentStatus } from '@prisma/client';

@ApiTags('Fulfillment - Expedição (Shipments)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fulfillment/shipping')
export class ShippingController {
  constructor(
    private readonly shippingService: ShippingService,
    private readonly labelService: LabelService,
  ) {}

  @Post()
  @Permissions('manage_shipping', 'shipping:manage')
  @ApiOperation({ summary: 'Criar registro de expedição (Shipment) para pacote embalado' })
  async createShipment(@Body() dto: CreateShipmentDto, @Request() req: any) {
    return this.shippingService.createShipment(dto, req.user.id, req.user);
  }

  @Get()
  @Permissions('shipping:read', 'manage_shipping')
  @ApiOperation({ summary: 'Listar expedições (Shipments)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ShipmentStatus })
  async listShipments(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: ShipmentStatus,
  ) {
    return this.shippingService.listShipments(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      warehouseId,
      status,
      req.user,
    );
  }

  @Get(':id')
  @Permissions('shipping:read', 'manage_shipping')
  @ApiOperation({ summary: 'Obter detalhes da expedição' })
  async getShipmentById(@Param('id') id: string, @Request() req: any) {
    return this.shippingService.getShipmentById(id, req.user);
  }

  @Post(':id/dispatch')
  @Permissions('manage_shipping', 'shipping:manage')
  @ApiOperation({ summary: 'Despachar pacote para a transportadora' })
  async dispatchShipment(@Param('id') id: string, @Body() dto: DispatchShipmentDto, @Request() req: any) {
    return this.shippingService.dispatchShipment(id, dto, req.user.id, req.user);
  }

  @Post(':id/cancel')
  @Permissions('manage_shipping', 'shipping:manage')
  @ApiOperation({ summary: 'Cancelar expedição' })
  async cancelShipment(@Param('id') id: string, @Body() dto: CancelShipmentDto, @Request() req: any) {
    return this.shippingService.cancelShipment(id, dto, req.user.id, req.user);
  }

  @Post(':id/reopen')
  @Permissions('manage_shipping', 'shipping:manage')
  @ApiOperation({ summary: 'Reabrir expedição' })
  async reopenShipment(@Param('id') id: string, @Body('reason') reason?: string, @Request() req?: any) {
    return this.shippingService.reopenShipment(id, reason, req?.user?.id, req?.user);
  }

  @Post('labels/:labelId/reprint')
  @Permissions('print_labels', 'manage_shipping')
  @ApiOperation({ summary: 'Reimprimir etiqueta de envio' })
  async reprintLabel(@Param('labelId') labelId: string, @Body('reason') reason: string, @Request() req: any) {
    return this.labelService.reprintLabel(labelId, reason, req.user.id, req.user);
  }
}
