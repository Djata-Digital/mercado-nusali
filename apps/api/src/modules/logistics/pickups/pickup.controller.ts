import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PickupService, CreatePickupInput } from './pickup.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PickupStatus } from '@prisma/client';

@ApiTags('Logística - Coletas (Pickups)')
@Controller()
export class PickupController {
  constructor(private readonly pickupService: PickupService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pickup:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Solicitar nova coleta logística para a remessa' })
  @Post('logistics/pickups')
  async createPickup(@Body() body: CreatePickupInput) {
    return this.pickupService.createPickup(body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pickup:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar detalhes da solicitação de coleta' })
  @Get('logistics/pickups/:id')
  async getPickupById(@Param('id') id: string) {
    return this.pickupService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pickup:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar status da solicitação de coleta' })
  @Patch('logistics/pickups/:id/status')
  async updatePickupStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: PickupStatus; notes?: string },
  ) {
    return this.pickupService.updateStatus(id, body.status, body.notes, req.user?.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('pickup:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar tentativa de coleta' })
  @Post('logistics/pickups/:id/attempts')
  async recordPickupAttempt(
    @Param('id') id: string,
    @Body() body: { driverId: string; status: PickupStatus; reason: string; notes?: string },
  ) {
    return this.pickupService.recordAttempt(id, body);
  }
}
