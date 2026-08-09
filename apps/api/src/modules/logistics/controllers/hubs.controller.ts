import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HubsService } from '../services/hubs.service';
import { CreateHubDto, UpdateHubDto } from '../dto/hub.dto';
import { CreateZoneDto, CreateStructureDto } from '../dto/zone.dto';
import { CreateLocationDto } from '../dto/location.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { WarehouseStatus } from '@prisma/client';

@ApiTags('Hubs Logísticos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hubs')
export class HubsController {
  constructor(private readonly hubsService: HubsService) {}

  @Post()
  @Permissions('hub:create', 'hub:manage')
  @ApiOperation({ summary: 'Criar novo HUB Logístico' })
  @ApiResponse({ status: 201, description: 'HUB criado com sucesso' })
  async createHub(@Body() dto: CreateHubDto, @Request() req: any) {
    return this.hubsService.createHub(dto, req.user.id);
  }

  @Get()
  @Permissions('hub:read')
  @ApiOperation({ summary: 'Listar HUBs logísticos' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'countryId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: WarehouseStatus })
  async listHubs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('countryId') countryId?: string,
    @Query('status') status?: WarehouseStatus,
  ) {
    return this.hubsService.listHubs(page ? Number(page) : 1, limit ? Number(limit) : 20, countryId, status);
  }

  @Get(':id')
  @Permissions('hub:read')
  @ApiOperation({ summary: 'Obter detalhes de um HUB logístico' })
  async getHubById(@Param('id') id: string) {
    return this.hubsService.getHubById(id);
  }

  @Patch(':id')
  @Permissions('hub:update', 'hub:manage')
  @ApiOperation({ summary: 'Atualizar dados de um HUB logístico' })
  async updateHub(@Param('id') id: string, @Body() dto: UpdateHubDto, @Request() req: any) {
    return this.hubsService.updateHub(id, dto, req.user.id);
  }

  @Get(':id/metrics')
  @Permissions('hub:read')
  @ApiOperation({ summary: 'Obter métricas de capacidade 3D do HUB (ocupação, peso, volume)' })
  async getHubMetrics(@Param('id') id: string) {
    return this.hubsService.getHubMetrics(id);
  }

  @Post('zones')
  @Permissions('zone:manage', 'hub:manage')
  @ApiOperation({ summary: 'Criar zona operacional no HUB' })
  async createZone(@Body() dto: CreateZoneDto) {
    return this.hubsService.createZone(dto);
  }

  @Post('zones/:zoneId/aisles')
  @Permissions('zone:manage', 'hub:manage')
  @ApiOperation({ summary: 'Criar corredor na zona' })
  async createAisle(@Param('zoneId') zoneId: string, @Body() dto: CreateStructureDto) {
    return this.hubsService.createAisle(zoneId, dto);
  }

  @Post('aisles/:aisleId/racks')
  @Permissions('zone:manage', 'hub:manage')
  @ApiOperation({ summary: 'Criar estante no corredor' })
  async createRack(@Param('aisleId') aisleId: string, @Body() dto: CreateStructureDto) {
    return this.hubsService.createRack(aisleId, dto);
  }

  @Post('racks/:rackId/shelves')
  @Permissions('zone:manage', 'hub:manage')
  @ApiOperation({ summary: 'Criar prateleira na estante' })
  async createShelf(@Param('rackId') rackId: string, @Body() dto: CreateStructureDto) {
    return this.hubsService.createShelf(rackId, dto);
  }

  @Post('locations')
  @Permissions('location:manage', 'hub:manage')
  @ApiOperation({ summary: 'Criar posição/bin física no HUB' })
  async createLocation(@Body() dto: CreateLocationDto) {
    return this.hubsService.createLocation(dto);
  }
}
