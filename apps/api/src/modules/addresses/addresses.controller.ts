import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { extractRequestInfo } from '../../common/utils/request-info.util';

@ApiTags('Addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @Permissions('address:create:self')
  @ApiOperation({ summary: 'Cadastrar novo endereço de comprador' })
  async createAddress(@Req() req: any, @Body() dto: CreateAddressDto) {
    const reqInfo = extractRequestInfo(req);
    const address = await this.addressesService.createAddress(req.user.id, dto, reqInfo);
    return { success: true, data: address };
  }

  @Get()
  @Permissions('address:read:self')
  @ApiOperation({ summary: 'Listar endereços do comprador autenticado' })
  async listAddresses(@Req() req: any) {
    const addresses = await this.addressesService.listUserAddresses(req.user.id);
    return { success: true, data: addresses };
  }

  @Get(':id')
  @Permissions('address:read:self')
  @ApiOperation({ summary: 'Obter detalhes de um endereço' })
  async getAddress(@Req() req: any, @Param('id') id: string) {
    const address = await this.addressesService.getAddressById(req.user.id, id);
    return { success: true, data: address };
  }

  @Patch(':id')
  @Permissions('address:update:self')
  @ApiOperation({ summary: 'Atualizar endereço' })
  async updateAddress(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    const reqInfo = extractRequestInfo(req);
    const address = await this.addressesService.updateAddress(req.user.id, id, dto, reqInfo);
    return { success: true, data: address };
  }

  @Patch(':id/default')
  @Permissions('address:update:self')
  @ApiOperation({ summary: 'Definir endereço como padrão' })
  async setDefaultAddress(@Req() req: any, @Param('id') id: string) {
    const reqInfo = extractRequestInfo(req);
    const address = await this.addressesService.setDefaultAddress(req.user.id, id, reqInfo);
    return { success: true, data: address };
  }

  @Delete(':id')
  @Permissions('address:delete:self')
  @ApiOperation({ summary: 'Remover endereço (soft delete)' })
  async deleteAddress(@Req() req: any, @Param('id') id: string) {
    const reqInfo = extractRequestInfo(req);
    const result = await this.addressesService.deleteAddress(req.user.id, id, reqInfo);
    return { success: true, message: result.message };
  }
}
