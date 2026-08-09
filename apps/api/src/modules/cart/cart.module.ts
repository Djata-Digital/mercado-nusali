import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { CartService } from './cart.service';
import { CartEventsService } from './services/cart-events.service';
import { CartPricingService } from './services/cart-pricing.service';
import { CartStockService } from './services/cart-stock.service';
import { CartSummaryService } from './services/cart-summary.service';
import { CartTransactionService } from './services/cart-transaction.service';
import { CartValidationService } from './services/cart-validation.service';

@Module({
  imports: [PrismaModule],

  providers: [
    CartService,
    CartEventsService,
    CartPricingService,
    CartStockService,
    CartSummaryService,
    CartTransactionService,
    CartValidationService,
  ],
  exports: [
    CartService,
    CartEventsService,
    CartPricingService,
    CartStockService,
    CartSummaryService,
    CartTransactionService,
    CartValidationService,
  ],
})
export class CartModule {}
