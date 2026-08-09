import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShippingQuotesService } from './shipping-quotes.service';
import { ShippingQuoteRequestDto } from './dto/shipping-quote.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Shipping Quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('checkout')
export class ShippingQuotesController {
  constructor(private readonly shippingQuotesService: ShippingQuotesService) {}

  @Post('shipping-quotes')
  @ApiOperation({ summary: 'Obter cotação simulada interna de entrega por loja' })
  async getQuotes(@Req() req: any, @Body() dto: ShippingQuoteRequestDto) {
    const result = await this.shippingQuotesService.calculateShippingQuotes(req.user.id, dto);
    return { success: true, data: result };
  }
}
