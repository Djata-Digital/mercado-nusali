import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DeliveryService, CreateDeliveryInput } from './delivery.service';
import { ProofOfDeliveryService, CompleteDeliveryWithCodeInput } from './proof-of-delivery.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';

@ApiTags('Logística - Entregas')
@Controller()
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly podService: ProofOfDeliveryService,
  ) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('delivery:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar ordem de entrega para shipment (Operacional)' })
  @Post('logistics/deliveries')
  async createDelivery(@Body() body: CreateDeliveryInput) {
    return this.deliveryService.createDelivery(body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('delivery:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar detalhes da entrega por ID' })
  @Get('logistics/deliveries/:id')
  async getDelivery(@Param('id') id: string) {
    return this.deliveryService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('delivery:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atribuir motorista e veículo à entrega' })
  @Post('logistics/deliveries/:id/assign')
  async assignDriver(@Param('id') id: string, @Body() body: { driverId: string; vehicleId: string }) {
    return this.deliveryService.assignDriverAndVehicle(id, body.driverId, body.vehicleId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('proof_of_delivery:create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Concluir entrega com Prova de Entrega por Código PIN Seguro' })
  @Post('deliveries/:id/proof/code')
  async completeWithCode(@Req() req: any, @Param('id') id: string, @Body() body: Omit<CompleteDeliveryWithCodeInput, 'deliveryId' | 'deliveredById'>) {
    return this.podService.completeWithCode({
      ...body,
      deliveryId: id,
      deliveredById: req.user.id,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('proof_of_delivery:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter Signed URL temporária para arquivo da prova de entrega' })
  @Get('deliveries/:id/proof/files/:fileId/url')
  async getSignedUrl(@Req() req: any, @Param('fileId') fileId: string) {
    return this.podService.getSignedUrl(fileId, req.user);
  }
}
