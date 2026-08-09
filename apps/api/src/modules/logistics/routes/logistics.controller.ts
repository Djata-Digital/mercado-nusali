import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeliveryRouteService, CreateDeliveryRouteInput } from './delivery-route.service';
import { LogisticsDriverService, CreateDriverInput } from '../resources/logistics-driver.service';
import { LogisticsVehicleService, CreateVehicleInput } from '../resources/logistics-vehicle.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { DeliveryRouteStatus, DriverStatus, VehicleStatus, VehicleType, CheckpointStatus } from '@prisma/client';

@ApiTags('Logística - Recursos, Motoristas, Veículos e Rotas')
@Controller()
export class LogisticsController {
  constructor(
    private readonly routeService: DeliveryRouteService,
    private readonly driverService: LogisticsDriverService,
    private readonly vehicleService: LogisticsVehicleService,
  ) {}

  // --- MOTORISTAS ---
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('driver:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastrar motorista logístico' })
  @Post('admin/logistics/drivers')
  async createDriver(@Body() body: CreateDriverInput) {
    return this.driverService.createDriver(body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('driver:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar motoristas logísticos' })
  @Get('admin/logistics/drivers')
  async getDrivers(@Query('carrierId') carrierId?: string, @Query('status') status?: DriverStatus) {
    return this.driverService.findAll(carrierId, status);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('driver:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar motorista por ID' })
  @Get('admin/logistics/drivers/:id')
  async getDriverById(@Param('id') id: string) {
    return this.driverService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('driver:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar cadastro de motorista' })
  @Patch('admin/logistics/drivers/:id')
  async updateDriver(@Param('id') id: string, @Body() body: Partial<CreateDriverInput>) {
    return this.driverService.updateDriver(id, body);
  }

  // --- VEÍCULOS ---
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('vehicle:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cadastrar veículo logístico' })
  @Post('admin/logistics/vehicles')
  async createVehicle(@Body() body: CreateVehicleInput) {
    return this.vehicleService.createVehicle(body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('vehicle:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar veículos logísticos' })
  @Get('admin/logistics/vehicles')
  async getVehicles(
    @Query('carrierId') carrierId?: string,
    @Query('status') status?: VehicleStatus,
    @Query('type') type?: VehicleType,
  ) {
    return this.vehicleService.findAll(carrierId, status, type);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('vehicle:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar veículo por ID' })
  @Get('admin/logistics/vehicles/:id')
  async getVehicleById(@Param('id') id: string) {
    return this.vehicleService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('vehicle:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar veículo logístico' })
  @Patch('admin/logistics/vehicles/:id')
  async updateVehicle(@Param('id') id: string, @Body() body: Partial<CreateVehicleInput>) {
    return this.vehicleService.updateVehicle(id, body);
  }

  // --- ROTAS DE ENTREGA ---
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('route:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar nova rota de entregas com otimização determinística de CEP' })
  @Post('logistics/routes')
  async createRoute(@Body() body: CreateDeliveryRouteInput) {
    return this.routeService.createRoute(body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('route:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar rotas de entrega' })
  @Get('logistics/routes')
  async getRoutes(
    @Query('carrierId') carrierId?: string,
    @Query('status') status?: DeliveryRouteStatus,
    @Query('driverId') driverId?: string,
  ) {
    return this.routeService.findAll({ carrierId, status, driverId });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('route:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar rota por ID' })
  @Get('logistics/routes/:id')
  async getRoute(@Param('id') id: string) {
    return this.routeService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('route:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adicionar parada a uma rota existente' })
  @Post('logistics/routes/:routeId/stops')
  async addRouteStop(
    @Param('routeId') routeId: string,
    @Body() body: { deliveryId: string; sequenceOrder?: number },
  ) {
    return this.routeService.addStop(routeId, body.deliveryId, body.sequenceOrder);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('route:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar status de parada da rota' })
  @Patch('logistics/route-stops/:id/status')
  async updateStopStatus(@Param('id') id: string, @Body() body: { status: CheckpointStatus }) {
    return this.routeService.updateStopStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('route:manage')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar status da rota (PLANNED -> IN_PROGRESS -> COMPLETED)' })
  @Patch('logistics/routes/:id/status')
  async updateRouteStatus(@Req() req: any, @Param('id') id: string, @Body() body: { status: DeliveryRouteStatus }) {
    return this.routeService.updateRouteStatus(id, body.status, req.user?.id);
  }
}
