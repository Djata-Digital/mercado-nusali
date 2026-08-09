import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TrackingStatus } from '@prisma/client';

@ApiTags('Logística - Rastreamento')
@Controller()
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Public()
  @ApiOperation({ summary: 'Consulta pública de rastreamento (Dados sanitizados de privacidade)' })
  @ApiResponse({ status: 200, description: 'Detalhes públicos do rastreamento retornados com sucesso.' })
  @ApiResponse({ status: 404, description: 'Rastreamento não encontrado.' })
  @Get('public/tracking/:trackingNumber')
  async getPublicTracking(@Param('trackingNumber') trackingNumber: string) {
    return this.trackingService.findPublicTracking(trackingNumber);
  }

  // Comprador
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:read:self')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar rastreamentos do comprador' })
  @Get('tracking')
  async getBuyerTrackings(@Req() req: any) {
    return this.trackingService.findAllBuyerTrackings(req.user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:read:self')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta de rastreamento pelo comprador (por código ou ID)' })
  @Get('tracking/:trackingNumber')
  async getBuyerTracking(@Req() req: any, @Param('trackingNumber') trackingNumber: string) {
    return this.trackingService.findBuyerTracking(req.user.id, trackingNumber);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:read:self')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta de rastreamento de um pedido específico do comprador' })
  @Get('orders/:orderId/tracking')
  async getBuyerTrackingByOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return this.trackingService.findBuyerTrackingByOrder(req.user.id, orderId);
  }

  // Vendedor
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:read:store')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar rastreamentos das lojas do vendedor' })
  @Get('seller/tracking')
  async getSellerTrackings(@Req() req: any) {
    return this.trackingService.findAllSellerTrackings(req.user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:read:store')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta operacional de rastreamento pelo vendedor' })
  @Get('seller/tracking/:id')
  async getSellerTracking(@Req() req: any, @Param('id') id: string) {
    return this.trackingService.findSellerTracking(req.user.id, id);
  }

  // Admin / Logística
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:read:admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos os rastreamentos (Admin)' })
  @Get('admin/tracking')
  async getAllAdminTrackings(@Query('status') status?: TrackingStatus, @Query('carrierId') carrierId?: string) {
    return this.trackingService.findAllAdminTrackings({ status, carrierId });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:read:admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detalhes completos do rastreamento (Admin)' })
  @Get('admin/tracking/:id')
  async getAdminTrackingById(@Param('id') id: string) {
    return this.trackingService.findAdminTrackingById(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:event:create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registro manual de evento de rastreamento por operador ou admin' })
  @Post('admin/tracking/:id/events')
  async addAdminTrackingEvent(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { eventCode: string; status: TrackingStatus; title: string; description?: string },
  ) {
    return this.trackingService.addEvent(
      id,
      body.eventCode,
      body.status,
      body.title,
      body.description,
      req.user.id,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Override manual do status de rastreamento com motivo auditado (Admin)' })
  @Patch('admin/tracking/:id/status')
  async overrideAdminTrackingStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: TrackingStatus; reason: string },
  ) {
    return this.trackingService.overrideStatus(id, body.status, body.reason, req.user.id);
  }

  // Checkpoints
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adicionar checkpoint ao rastreamento (Admin)' })
  @Post('admin/tracking/:id/checkpoints')
  async addCheckpoint(@Param('id') id: string, @Body() body: any) {
    return this.trackingService.addCheckpoint(id, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:read:self')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar checkpoints de um rastreamento' })
  @Get('tracking/:id/checkpoints')
  async getCheckpoints(@Param('id') id: string) {
    return this.trackingService.findCheckpoints(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('tracking:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar checkpoint (Admin)' })
  @Patch('admin/tracking-checkpoints/:id')
  async updateCheckpoint(@Param('id') id: string, @Body() body: any) {
    return this.trackingService.updateCheckpoint(id, body);
  }
}
