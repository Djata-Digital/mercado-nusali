import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CartService, AddCartItemInput, UpdateCartItemInput } from './cart.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.cartService.getOrCreateCart(userId);
  }

  @Post('items')
  async addItem(@Req() req: any, @Body() body: AddCartItemInput) {
    const userId = req.user.sub || req.user.id;
    return this.cartService.addItem(userId, body);
  }

  @Patch('items/:id')
  async updateItem(
    @Req() req: any,
    @Param('id') itemId: string,
    @Body() body: UpdateCartItemInput,
  ) {
    const userId = req.user.sub || req.user.id;
    return this.cartService.updateItem(userId, itemId, body);
  }

  @Delete('items/:id')
  async removeItem(@Req() req: any, @Param('id') itemId: string) {
    const userId = req.user.sub || req.user.id;
    return this.cartService.removeItem(userId, itemId);
  }

  @Delete()
  async clearCart(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.cartService.clearCart(userId);
  }
}
