import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CarrierService, CreateCarrierInput, CreateCarrierAccountInput } from './carrier.service';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CarrierStatus, CarrierType } from '@prisma/client';

@ApiTags('Logística - Transportadoras')
@Controller()
export class CarrierController {
  constructor(private readonly carrierService: CarrierService) {}

  @Public()
  @ApiOperation({ summary: 'Listar transportadoras ativas para o público/checkout' })
  @Get('public/carriers')
  async getPublicCarriers() {
    return this.carrierService.findPublicCarriers();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todas as transportadoras (Admin)' })
  @Get('admin/carriers')
  async getAllCarriers(@Query('status') status?: CarrierStatus, @Query('type') type?: CarrierType) {
    return this.carrierService.findAll(status, type);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar transportadora por ID (Admin)' })
  @Get('admin/carriers/:id')
  async getCarrierById(@Param('id') id: string) {
    return this.carrierService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastrar nova transportadora (Admin)' })
  @Post('admin/carriers')
  async createCarrier(@Body() body: CreateCarrierInput) {
    return this.carrierService.createCarrier(body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar transportadora (Admin)' })
  @Patch('admin/carriers/:id')
  async updateCarrier(@Param('id') id: string, @Body() body: Partial<CreateCarrierInput>) {
    return this.carrierService.updateCarrier(id, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar status da transportadora (Admin)' })
  @Patch('admin/carriers/:id/status')
  async updateCarrierStatus(@Param('id') id: string, @Body() body: { status: CarrierStatus }) {
    return this.carrierService.updateStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desativar/Remover transportadora com Soft Delete (Admin)' })
  @Delete('admin/carriers/:id')
  async deleteCarrier(@Param('id') id: string) {
    return this.carrierService.softDelete(id);
  }

  // Carrier Accounts
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastrar conta de integração segura da transportadora (Admin)' })
  @Post('admin/carriers/:carrierId/accounts')
  async createCarrierAccount(@Param('carrierId') carrierId: string, @Body() body: Omit<CreateCarrierAccountInput, 'carrierId'>) {
    return this.carrierService.createAccount({ ...body, carrierId });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar contas de integração da transportadora (Admin)' })
  @Get('admin/carriers/:carrierId/accounts')
  async getCarrierAccounts(@Param('carrierId') carrierId: string) {
    return this.carrierService.findAccounts(carrierId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar conta de integração (Admin)' })
  @Patch('admin/carrier-accounts/:id')
  async updateCarrierAccount(@Param('id') id: string, @Body() body: Partial<CreateCarrierAccountInput>) {
    return this.carrierService.updateAccount(id, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover conta de integração (Admin)' })
  @Delete('admin/carrier-accounts/:id')
  async deleteCarrierAccount(@Param('id') id: string) {
    return this.carrierService.deleteAccount(id);
  }

  // Carrier Services
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar serviço de transportadora (Admin)' })
  @Post('admin/carriers/:carrierId/services')
  async createCarrierService(@Param('carrierId') carrierId: string, @Body() body: any) {
    return this.carrierService.createService(carrierId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar serviços da transportadora (Admin)' })
  @Get('admin/carriers/:carrierId/services')
  async getCarrierServices(@Param('carrierId') carrierId: string) {
    return this.carrierService.findServices(carrierId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar serviço da transportadora (Admin)' })
  @Patch('admin/carrier-services/:id')
  async updateCarrierService(@Param('id') id: string, @Body() body: any) {
    return this.carrierService.updateService(id, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover serviço da transportadora (Admin)' })
  @Delete('admin/carrier-services/:id')
  async deleteCarrierService(@Param('id') id: string) {
    return this.carrierService.deleteService(id);
  }

  // Carrier Service Zones
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar zona de serviço da transportadora (Admin)' })
  @Post('admin/carrier-services/:serviceId/zones')
  async createCarrierServiceZone(@Param('serviceId') serviceId: string, @Body() body: any) {
    return this.carrierService.createServiceZone(serviceId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar zonas do serviço da transportadora (Admin)' })
  @Get('admin/carrier-services/:serviceId/zones')
  async getCarrierServiceZones(@Param('serviceId') serviceId: string) {
    return this.carrierService.findServiceZones(serviceId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar zona de serviço (Admin)' })
  @Patch('admin/carrier-service-zones/:id')
  async updateCarrierServiceZone(@Param('id') id: string, @Body() body: any) {
    return this.carrierService.updateServiceZone(id, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover zona de serviço (Admin)' })
  @Delete('admin/carrier-service-zones/:id')
  async deleteCarrierServiceZone(@Param('id') id: string) {
    return this.carrierService.deleteServiceZone(id);
  }
}
