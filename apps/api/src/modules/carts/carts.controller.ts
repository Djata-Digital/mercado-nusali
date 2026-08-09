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
import { CartsService } from './carts.service';
import { AddCartItemDto, UpdateCartItemDto, MergeCartDto, ApplyCartCouponDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { extractRequestInfo } from '../../common/utils/request-info.util';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cart')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  @Permissions('cart:manage:self')
  @ApiOperation({ summary: 'Obter carrinho ativo agrupado por loja' })
  async getCart(@Req() req: any) {
    return this.cartsService.getCart(req.user.id);
  }

  @Post('items')
  @Permissions('cart:manage:self')
  @ApiOperation({ summary: 'Adicionar variante ao carrinho (apenas variantId e quantity)' })
  async addItem(@Req() req: any, @Body() dto: AddCartItemDto) {
    const reqInfo = extractRequestInfo(req);
    return this.cartsService.addItem(req.user.id, dto, reqInfo);
  }

  @Patch('items/:itemId')
  @Permissions('cart:manage:self')
  @ApiOperation({ summary: 'Atualizar quantidade de um item do carrinho' })
  async updateItem(
    @Req() req: any,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const reqInfo = extractRequestInfo(req);
    return this.cartsService.updateItem(req.user.id, itemId, dto, reqInfo);
  }

  @Delete('items/:itemId')
  @Permissions('cart:manage:self')
  @ApiOperation({ summary: 'Remover item do carrinho' })
  async removeItem(@Req() req: any, @Param('itemId') itemId: string) {
    const reqInfo = extractRequestInfo(req);
    return this.cartsService.removeItem(req.user.id, itemId, reqInfo);
  }

  @Delete()
  @Permissions('cart:manage:self')
  @ApiOperation({ summary: 'Esvaziar carrinho' })
  async clearCart(@Req() req: any) {
    const reqInfo = extractRequestInfo(req);
    return this.cartsService.clearCart(req.user.id, undefined, reqInfo);
  }

  @Post('merge')
  @Permissions('cart:manage:self')
  @ApiOperation({ summary: 'Mesclar itens de carrinho anônimo no carrinho autenticado' })
  async mergeCart(@Req() req: any, @Body() dto: MergeCartDto) {
    const reqInfo = extractRequestInfo(req);
    return this.cartsService.mergeCart(req.user.id, dto, reqInfo);
  }

  @Post('coupon')
  @Permissions('coupon:validate')
  @ApiOperation({ summary: 'Aplicar cupom ao carrinho' })
  async applyCoupon(@Req() req: any, @Body() dto: ApplyCartCouponDto) {
    const reqInfo = extractRequestInfo(req);
    return this.cartsService.applyCoupon(req.user.id, dto, reqInfo);
  }

  @Delete('coupon')
  @Permissions('cart:manage:self')
  @ApiOperation({ summary: 'Remover cupom do carrinho' })
  async removeCoupon(@Req() req: any) {
    const reqInfo = extractRequestInfo(req);
    return this.cartsService.removeCoupon(req.user.id, reqInfo);
  }
}
