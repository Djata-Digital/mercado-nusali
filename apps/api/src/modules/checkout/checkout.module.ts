import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CartModule } from '../cart/cart.module';
import { CouponService } from '../coupons/coupon.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StockReservationsModule } from '../stock-reservations/stock-reservations.module';
import { CheckoutController } from './checkout.controller';
import {
  CHECKOUT_EXPIRATION_QUEUE,
  CheckoutExpirationProcessor,
} from './jobs/checkout-expiration.processor';
import { CheckoutExpirationScheduler } from './jobs/checkout-expiration.scheduler';
import { CheckoutService } from './checkout.service';
import { CheckoutConfirmationService } from './services/checkout-confirmation.service';
import { CheckoutEventsService } from './services/checkout-events.service';
import { CheckoutExpirationService } from './services/checkout-expiration.service';
import { CheckoutRecoveryService } from './services/checkout-recovery.service';
import { CheckoutPreviewService } from './services/checkout-preview.service';
import { CheckoutShippingSelectionService } from './services/checkout-shipping-selection.service';
import { CheckoutTransactionService } from './services/checkout-transaction.service';
import { CheckoutValidationService } from './services/checkout-validation.service';
import {
  GenericLocalShippingProvider,
  InternalShippingProvider,
  ShippingCalculationService,
} from './shipping/shipping-calculation.service';

const bullMqWorkersEnabled = process.env.DISABLE_BULLMQ_WORKERS !== 'true';

@Module({
  imports: [
    PrismaModule,
    CartModule,
    StockReservationsModule,
    ...(bullMqWorkersEnabled
      ? [BullModule.registerQueue({ name: CHECKOUT_EXPIRATION_QUEUE })]
      : []),
  ],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    CheckoutConfirmationService,
    CheckoutValidationService,
    CheckoutEventsService,
    CheckoutExpirationService,
    ...(bullMqWorkersEnabled
      ? [CheckoutExpirationProcessor, CheckoutExpirationScheduler]
      : []),
    CheckoutRecoveryService,
    CheckoutPreviewService,
    CheckoutShippingSelectionService,
    CheckoutTransactionService,
    InternalShippingProvider,
    GenericLocalShippingProvider,
    ShippingCalculationService,
    CouponService,
  ],
  exports: [
    CheckoutService,
    CheckoutConfirmationService,
    CheckoutEventsService,
    CheckoutExpirationService,
    ...(bullMqWorkersEnabled
      ? [CheckoutExpirationProcessor, CheckoutExpirationScheduler]
      : []),
    CheckoutRecoveryService,
    CheckoutPreviewService,
    CheckoutShippingSelectionService,
    CheckoutTransactionService,
    CheckoutValidationService,
    ShippingCalculationService,
    CouponService,
  ],
})
export class CheckoutModule {}
