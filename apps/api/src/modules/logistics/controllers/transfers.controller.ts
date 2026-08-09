import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TransfersService } from '../services/transfers.service';
import { CreateTransferOrderDto } from '../dto/transfer.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TransferOrderStatus } from '@prisma/client';

@ApiTags('Transferências entre HUBs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('logistics/transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @Permissions('transfer:create', 'hub:manage')
  @ApiOperation({ summary: 'Solicitar transferência de produtos entre HUBs' })
  async createTransfer(@Body() dto: CreateTransferOrderDto, @Request() req: any) {
    return this.transfersService.createTransfer(dto, req.user.id);
  }

  @Get()
  @Permissions('transfer:read')
  @ApiOperation({ summary: 'Listar transferências entre HUBs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'originWarehouseId', required: false, type: String })
  @ApiQuery({ name: 'destinationWarehouseId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: TransferOrderStatus })
  async listTransfers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('originWarehouseId') originWarehouseId?: string,
    @Query('destinationWarehouseId') destinationWarehouseId?: string,
    @Query('status') status?: TransferOrderStatus,
  ) {
    return this.transfersService.listTransfers(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      originWarehouseId,
      destinationWarehouseId,
      status,
    );
  }

  @Get(':id')
  @Permissions('transfer:read')
  @ApiOperation({ summary: 'Obter detalhes da transferência' })
  async getTransferById(@Param('id') id: string) {
    return this.transfersService.getTransferById(id);
  }

  @Post(':id/approve')
  @Permissions('transfer:approve', 'hub:manage')
  @ApiOperation({ summary: 'Aprovar solicitação de transferência' })
  async approveTransfer(@Param('id') id: string, @Request() req: any) {
    return this.transfersService.approveTransfer(id, req.user.id);
  }

  @Post(':id/ship')
  @Permissions('transfer:ship', 'hub:manage')
  @ApiOperation({ summary: 'Expedir transferência e colocar em trânsito' })
  async shipTransfer(@Param('id') id: string, @Request() req: any) {
    return this.transfersService.shipTransfer(id, req.user.id);
  }

  @Post(':id/receive')
  @Permissions('transfer:receive', 'hub:manage')
  @ApiOperation({ summary: 'Registrar chegada de transferência na doca' })
  async receiveTransfer(@Param('id') id: string, @Request() req: any) {
    return this.transfersService.receiveTransfer(id, req.user.id);
  }

  @Post(':id/complete')
  @Permissions('transfer:receive', 'hub:manage')
  @ApiOperation({ summary: 'Concluir transferência e disponibilizar no estoque de destino' })
  async completeTransfer(@Param('id') id: string, @Request() req: any) {
    return this.transfersService.completeTransfer(id, req.user.id);
  }

  @Post(':id/cancel')
  @Permissions('transfer:approve', 'hub:manage')
  @ApiOperation({ summary: 'Cancelar solicitação de transferência' })
  async cancelTransfer(@Param('id') id: string, @Request() req: any) {
    return this.transfersService.cancelTransfer(id, req.user.id);
  }
}
