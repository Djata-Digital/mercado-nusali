import { Module } from '@nestjs/common';
import { ShippingQuotesController } from './shipping-quotes.controller';
import { ShippingQuotesService } from './shipping-quotes.service';

@Module({
  controllers: [ShippingQuotesController],
  providers: [ShippingQuotesService],
  exports: [ShippingQuotesService],
})
export class ShippingQuotesModule {}
