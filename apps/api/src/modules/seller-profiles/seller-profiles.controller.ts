import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SellerProfilesService } from './seller-profiles.service';
import { OnboardingSellerDto } from './dto/onboarding.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import { UpdateSellerStatusDto } from './dto/update-seller-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Sellers')
@ApiBearerAuth()
@Controller('sellers')
export class SellerProfilesController {
  constructor(private readonly sellerProfilesService: SellerProfilesService) {}

  private extractReqInfo(req: Request) {
    return {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }

  @Post('onboarding')
  @ApiOperation({ summary: 'Iniciar onboarding de vendedor' })
  async onboarding(
    @CurrentUser('id') userId: string,
    @Body() dto: OnboardingSellerDto,
    @Req() req: Request,
  ) {
    return this.sellerProfilesService.onboarding(userId, dto, this.extractReqInfo(req));
  }

  @Get('me')
  @Permissions('seller:read:self')
  @ApiOperation({ summary: 'Obter perfil do vendedor autenticado' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.sellerProfilesService.getMyProfile(userId);
  }

  @Patch('me')
  @Permissions('seller:update:self')
  @ApiOperation({ summary: 'Atualizar perfil do vendedor autenticado' })
  async updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSellerProfileDto,
    @Req() req: Request,
  ) {
    return this.sellerProfilesService.updateMyProfile(userId, dto, this.extractReqInfo(req));
  }

  @Get()
  @Permissions('seller:read:any')
  @ApiOperation({ summary: 'Listar todos os vendedores (Admin/Suporte)' })
  async listSellers(@Query() query: any) {
    return this.sellerProfilesService.listSellers(query);
  }

  @Get(':id')
  @Permissions('seller:read:any')
  @ApiOperation({ summary: 'Obter detalhes de vendedor por ID' })
  async getById(@Param('id') id: string) {
    return this.sellerProfilesService.getById(id);
  }

  @Patch(':id/status')
  @Permissions('seller:approve')
  @Roles('ADMIN', 'GLOBAL_ADMIN', 'KYC_ANALYST')
  @ApiOperation({ summary: 'Atualizar status do vendedor (Aprovar/Rejeitar)' })
  async updateStatus(
    @CurrentUser('id') adminUserId: string,
    @Param('id') sellerId: string,
    @Body() dto: UpdateSellerStatusDto,
    @Req() req: Request,
  ) {
    return this.sellerProfilesService.updateStatus(adminUserId, sellerId, dto, this.extractReqInfo(req));
  }
}
