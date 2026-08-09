import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PickingService } from '../services/picking.service';
import {
  CreatePickingOrderDto,
  CreatePickingBatchDto,
  CompletePickingOrderDto,
  CancelPickingOrderDto,
} from '../dto/picking.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PickingOrderStatus } from '@prisma/client';

@ApiTags('Fulfillment - Picking (Separação de Pedidos)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fulfillment/picking')
export class PickingController {
  constructor(private readonly pickingService: PickingService) {}

  @Post()
  @Permissions('manage_picking', 'picking:manage')
  @ApiOperation({ summary: 'Gerar Ordem de Picking para um pedido e armazém especifico' })
  async createPickingOrder(@Body() dto: CreatePickingOrderDto, @Request() req: any) {
    return this.pickingService.createPickingOrder(dto, req.user.id, req.user);
  }

  @Post('order/:orderId/generate')
  @Permissions('manage_picking', 'picking:manage')
  @ApiOperation({ summary: 'Gerar idempotentemente todas as Ordens de Picking para um pedido (múltiplos armazéns)' })
  async generatePickingOrdersForOrder(@Param('orderId') orderId: string, @Request() req: any) {
    return this.pickingService.createPickingOrdersForOrder(orderId, req.user.id, req.user);
  }

  @Post('batches')
  @Permissions('manage_picking', 'picking:manage')
  @ApiOperation({ summary: 'Criar lote de separação (Batch/Wave Picking) para múltiplos pedidos' })
  async createBatch(@Body() dto: CreatePickingBatchDto, @Request() req: any) {
    return this.pickingService.createBatch(dto, req.user.id, req.user);
  }

  @Get()
  @Permissions('picking:read', 'manage_picking')
  @ApiOperation({ summary: 'Listar Ordens de Picking' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: PickingOrderStatus })
  @ApiQuery({ name: 'batchId', required: false, type: String })
  async listPickingOrders(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('warehouseId') warehouseId?: string,
    @Query('status') status?: PickingOrderStatus,
    @Query('batchId') batchId?: string,
  ) {
    return this.pickingService.listPickingOrders(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      warehouseId,
      status,
      batchId,
      req.user,
    );
  }

  @Get(':id')
  @Permissions('picking:read', 'manage_picking')
  @ApiOperation({ summary: 'Obter detalhes de uma Ordem de Picking' })
  async getPickingOrderById(@Param('id') id: string, @Request() req: any) {
    return this.pickingService.getPickingOrderById(id, req.user);
  }

  @Post(':id/assign')
  @Permissions('manage_picking', 'picking:manage')
  @ApiOperation({ summary: 'Atribuir operador a uma Ordem de Picking' })
  async assignOperator(
    @Param('id') id: string,
    @Body('operatorId') operatorId: string,
    @Body('reason') reason?: string,
    @Request() req?: any,
  ) {
    return this.pickingService.assignOperator(id, operatorId, reason, req?.user?.id, req?.user);
  }

  @Post(':id/start')
  @Permissions('manage_picking', 'picking:manage')
  @ApiOperation({ summary: 'Iniciar processo de separação física dos produtos' })
  async startPicking(@Param('id') id: string, @Request() req: any) {
    return this.pickingService.startPicking(id, req.user.id, req.user);
  }

  @Post(':id/items')
  @Permissions('manage_picking', 'picking:manage')
  @ApiOperation({ summary: 'Lançar itens separados pelo operador' })
  async pickItems(@Param('id') id: string, @Body() dto: CompletePickingOrderDto, @Request() req: any) {
    return this.pickingService.pickItems(id, dto, req.user.id, req.user);
  }

  @Post(':id/cancel')
  @Permissions('manage_picking', 'picking:manage')
  @ApiOperation({ summary: 'Cancelar Ordem de Picking' })
  async cancelPicking(@Param('id') id: string, @Body() dto: CancelPickingOrderDto, @Request() req: any) {
    return this.pickingService.cancelPicking(id, dto, req.user.id, req.user);
  }

  @Post(':id/reopen')
  @Permissions('manage_picking', 'picking:manage')
  @ApiOperation({ summary: 'Reabrir Ordem de Picking para nova conferência' })
  async reopenPicking(
    @Param('id') id: string,
    @Body('reason') reason?: string,
    @Request() req?: any,
  ) {
    return this.pickingService.reopenPicking(id, reason, req?.user?.id, req?.user);
  }
}
