import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WarehouseOperationsService } from '../services/warehouse-operations.service';
import { CreateWarehouseMovementDto } from '../dto/movement.dto';
import { CreateCycleCountDto, SubmitCycleCountDto } from '../dto/cycle-count.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';

@ApiTags('Operações de Armazém & Inventário Cíclico')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('logistics/operations')
export class WarehouseOperationsController {
  constructor(private readonly operationsService: WarehouseOperationsService) {}

  @Post('movements')
  @Permissions('movement:create', 'hub:manage')
  @ApiOperation({ summary: 'Mover produtos entre posições físicas internas do HUB' })
  async createMovement(@Body() dto: CreateWarehouseMovementDto, @Request() req: any) {
    return this.operationsService.createMovement(dto, req.user.id);
  }

  @Get('movements')
  @Permissions('movement:read')
  @ApiOperation({ summary: 'Listar movimentações físicas internas' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'variantId', required: false, type: String })
  async listMovements(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('warehouseId') warehouseId?: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.operationsService.listMovements(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      warehouseId,
      variantId,
    );
  }

  @Post('cycle-counts')
  @Permissions('cyclecount:create', 'hub:manage')
  @ApiOperation({ summary: 'Agendar ordem de inventário cíclico' })
  async createCycleCount(@Body() dto: CreateCycleCountDto, @Request() req: any) {
    return this.operationsService.createCycleCount(dto, req.user.id);
  }

  @Get('cycle-counts/:id')
  @Permissions('cyclecount:read')
  @ApiOperation({ summary: 'Obter detalhes da ordem de inventário cíclico' })
  async getCycleCountById(@Param('id') id: string) {
    return this.operationsService.getCycleCountById(id);
  }

  @Post('cycle-counts/:id/start')
  @Permissions('cyclecount:create', 'hub:manage')
  @ApiOperation({ summary: 'Iniciar auditoria física de inventário' })
  async startCycleCount(@Param('id') id: string) {
    return this.operationsService.startCycleCount(id);
  }

  @Post('cycle-counts/:id/submit')
  @Permissions('cyclecount:count', 'hub:manage')
  @ApiOperation({ summary: 'Lançar contagens e recontagens físicas realizadas' })
  async submitCounts(@Param('id') id: string, @Body() dto: SubmitCycleCountDto) {
    return this.operationsService.submitCounts(id, dto);
  }

  @Post('cycle-counts/:id/reconcile')
  @Permissions('cyclecount:adjust', 'hub:manage')
  @ApiOperation({ summary: 'Aprovar e aplicar conciliação de divergências no estoque' })
  async reconcileAndAdjust(@Param('id') id: string, @Request() req: any) {
    return this.operationsService.reconcileAndAdjust(id, req.user.id);
  }
}
