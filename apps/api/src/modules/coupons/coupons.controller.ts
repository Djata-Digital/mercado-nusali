import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { extractRequestInfo } from '../../common/utils/request-info.util';

@ApiTags('Coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('coupons/validate')
  @Permissions('coupon:validate')
  @ApiOperation({ summary: 'Validar elegibilidade e calcular desconto de um cupom' })
  async validateCoupon(@Req() req: any, @Body() dto: ValidateCouponDto) {
    const result = await this.couponsService.validateCoupon(req.user.id, dto);
    return { success: true, data: result };
  }

  @Post('seller/coupons')
  @Permissions('coupon:manage:store')
  @ApiOperation({ summary: 'Criar novo cupom pelo vendedor' })
  async createSellerCoupon(@Req() req: any, @Body() dto: CreateCouponDto) {
    const reqInfo = extractRequestInfo(req);
    const coupon = await this.couponsService.createCoupon(req.user.id, dto, reqInfo);
    return { success: true, data: coupon };
  }

  @Get('seller/coupons')
  @Permissions('coupon:manage:store')
  @ApiOperation({ summary: 'Listar cupons do vendedor' })
  async listSellerCoupons(@Query() query: any) {
    const coupons = await this.couponsService.listCoupons(query);
    return { success: true, data: coupons };
  }

  @Get('seller/coupons/:id')
  @Permissions('coupon:manage:store')
  @ApiOperation({ summary: 'Obter detalhes de um cupom do vendedor' })
  async getSellerCoupon(@Param('id') id: string) {
    const coupon = await this.couponsService.getCouponById(id);
    return { success: true, data: coupon };
  }

  @Patch('seller/coupons/:id')
  @Permissions('coupon:manage:store')
  @ApiOperation({ summary: 'Atualizar cupom pelo vendedor' })
  async updateSellerCoupon(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const reqInfo = extractRequestInfo(req);
    const coupon = await this.couponsService.updateCoupon(req.user.id, id, dto, reqInfo);
    return { success: true, data: coupon };
  }

  @Post('admin/coupons')
  @Permissions('coupon:manage:platform')
  @ApiOperation({ summary: 'Criar cupom de plataforma pelo administrador' })
  async createAdminCoupon(@Req() req: any, @Body() dto: CreateCouponDto) {
    const reqInfo = extractRequestInfo(req);
    const coupon = await this.couponsService.createCoupon(req.user.id, dto, reqInfo);
    return { success: true, data: coupon };
  }

  @Get('admin/coupons')
  @Permissions('coupon:manage:platform')
  @ApiOperation({ summary: 'Listar todos os cupons da plataforma' })
  async listAdminCoupons(@Query() query: any) {
    const coupons = await this.couponsService.listCoupons(query);
    return { success: true, data: coupons };
  }

  @Patch('admin/coupons/:id')
  @Permissions('coupon:manage:platform')
  @ApiOperation({ summary: 'Atualizar qualquer cupom pela administração' })
  async updateAdminCoupon(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const reqInfo = extractRequestInfo(req);
    const coupon = await this.couponsService.updateCoupon(req.user.id, id, dto, reqInfo);
    return { success: true, data: coupon };
  }
}
