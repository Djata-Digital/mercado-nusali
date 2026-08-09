import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  AdjustInventoryDto,
  ReserveInventoryDto,
  ReleaseInventoryDto,
  TransferInventoryDto,
} from './dto/inventory-operations.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Get()
  @ApiOperation({ summary: 'Listar itens de estoque autorizados com filtros e paginação' })
  async listInventory(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Query() query: any,
  ) {
    return this.inventoryService.listInventory(userId, userRoles || [], query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes do estoque de uma variante em um armazém' })
  async getInventoryItemById(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
  ) {
    return this.inventoryService.getInventoryItemById(userId, userRoles || [], id);
  }

  @Post('adjust')
  @ApiOperation({ summary: 'Ajustar quantidade física de estoque (Transacional)' })
  async adjustStock(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: AdjustInventoryDto,
    @Req() req: Request,
  ) {
    return this.inventoryService.adjustStock(userId, userRoles || [], dto, this.extractReqInfo(req));
  }

  @Post('reserve')
  @ApiOperation({ summary: 'Reservar quantidade de estoque (Atômico)' })
  async reserveStock(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: ReserveInventoryDto,
    @Req() req: Request,
  ) {
    return this.inventoryService.reserveStock(userId, userRoles || [], dto, this.extractReqInfo(req));
  }

  @Post('release')
  @ApiOperation({ summary: 'Liberar quantidade reservada de estoque (Atômico)' })
  async releaseStock(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: ReleaseInventoryDto,
    @Req() req: Request,
  ) {
    return this.inventoryService.releaseStock(userId, userRoles || [], dto, this.extractReqInfo(req));
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transferir estoque entre armazéns (Transacional Atômico)' })
  async transferStock(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Body() dto: TransferInventoryDto,
    @Req() req: Request,
  ) {
    return this.inventoryService.transferStock(userId, userRoles || [], dto, this.extractReqInfo(req));
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Histórico de movimentações de um item de estoque' })
  async getMovementsByItem(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') userRoles: string[],
    @Param('id') id: string,
    @Query() query: any,
  ) {
    return this.inventoryService.getMovementsByItem(userId, userRoles || [], id, query);
  }
}
