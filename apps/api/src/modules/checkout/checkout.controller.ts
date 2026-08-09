import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { CheckoutService, CreateCheckoutInput, ConfirmCheckoutInput } from './checkout.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('session')
  async createSession(@Req() req: any, @Body() body: CreateCheckoutInput) {
    const userId = req.user.sub || req.user.id;
    return this.checkoutService.createCheckoutSession(userId, body);
  }

  @Post('confirm')
  async confirmCheckout(@Req() req: any, @Body() body: ConfirmCheckoutInput) {
    const userId = req.user.sub || req.user.id;
    return this.checkoutService.confirmCheckout(userId, body);
  }
}
