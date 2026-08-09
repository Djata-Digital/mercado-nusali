import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { WarehouseStatus } from '@prisma/client';

@ApiTags('Warehouses')
@ApiBearerAuth()
@Controller()
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post('warehouses')
  @ApiOperation({ summary: 'Cadastrar novo armazém' })
  async createWarehouse(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: CreateWarehouseDto,
    @Req() req: Request,
  ) {
    return this.warehousesService.createWarehouse(userId, userRoles, dto, this.extractReqInfo(req));
  }

  @Get('warehouses/me')
  @ApiOperation({ summary: 'Listar armazéns do próprio vendedor' })
  async getMyWarehouses(@CurrentUser('id') userId: string) {
    return this.warehousesService.getMyWarehouses(userId);
  }

  @Get('warehouses/:id')
  @ApiOperation({ summary: 'Obter detalhes do armazém por ID' })
  async getWarehouseById(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.warehousesService.getWarehouseById(userId, userRoles, id);
  }

  @Patch('warehouses/:id')
  @ApiOperation({ summary: 'Atualizar armazém' })
  async updateWarehouse(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.warehousesService.updateWarehouse(userId, userRoles, id, body, this.extractReqInfo(req));
  }

  @Delete('warehouses/:id')
  @ApiOperation({ summary: 'Desativar armazém' })
  async deleteWarehouse(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.warehousesService.deleteWarehouse(userId, userRoles, id, this.extractReqInfo(req));
  }

  // Admin Routes
  @Get('admin/warehouses')
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'WAREHOUSE_MANAGER', 'LOGISTICS')
  @ApiOperation({ summary: 'Listar todos os armazéns (Admin)' })
  async listAdminWarehouses(@Query() query: any) {
    return this.warehousesService.listAdminWarehouses(query);
  }

  @Patch('admin/warehouses/:id/status')
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'WAREHOUSE_MANAGER')
  @ApiOperation({ summary: 'Atualizar status do armazém (Admin)' })
  async updateWarehouseStatus(
    @CurrentUser('id') adminUserId: string,
    @Param('id') id: string,
    @Body('status') status: WarehouseStatus,
    @Req() req: Request,
  ) {
    return this.warehousesService.updateWarehouseStatus(adminUserId, id, status, this.extractReqInfo(req));
  }
}
