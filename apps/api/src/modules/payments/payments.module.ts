import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentIntentsService } from './payment-intents.service';
import { OrangeMoneyProvider } from './providers/orange-money.provider';
import { MTNMoneyProvider } from './providers/mtn-money.provider';
import { PixProvider } from './providers/pix.provider';
import { CardProvider } from './providers/card.provider';
import { WalletProvider } from './providers/wallet.provider';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PrismaModule } from '../prisma/prisma.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { EscrowModule } from '../escrow/escrow.module';
import { WalletModule } from '../wallet/wallet.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PaymentStateMachineService } from './state-machine/payment-state-machine.service';
import { PaymentTransactionService } from './services/payment-transaction.service';
import { PaymentAttemptsService } from './services/payment-attempts.service';
import { PaymentEventsService } from './services/payment-events.service';
import { PaymentGatewayErrorClassifierService } from './services/payment-gateway-error-classifier.service';
import { PaymentProviderTimeoutService } from './services/payment-provider-timeout.service';
import { PaymentCircuitBreakerService } from './services/payment-circuit-breaker.service';
import { PaymentLogSanitizerService } from './services/payment-log-sanitizer.service';
import { PaymentProviderValidatorService } from './services/payment-provider-validator.service';

@Module({
  imports: [
    PrismaModule,
    IdempotencyModule,
    EscrowModule,
    WalletModule,
    OutboxModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentIntentsService,
    OrangeMoneyProvider,
    MTNMoneyProvider,
    PixProvider,
    CardProvider,
    WalletProvider,
    PaymentProviderFactory,
    PaymentStateMachineService,
    PaymentTransactionService,
    PaymentAttemptsService,
    PaymentEventsService,
    PaymentGatewayErrorClassifierService,
    PaymentProviderTimeoutService,
    PaymentCircuitBreakerService,
    PaymentLogSanitizerService,
    PaymentProviderValidatorService,
  ],
  exports: [
    PaymentsService,
    PaymentIntentsService,
    PaymentStateMachineService,
    PaymentTransactionService,
    PaymentAttemptsService,
    PaymentEventsService,
    PaymentProviderFactory,
    PaymentGatewayErrorClassifierService,
    PaymentProviderTimeoutService,
    PaymentCircuitBreakerService,
    PaymentLogSanitizerService,
    PaymentProviderValidatorService,
  ],
})
export class PaymentsModule {}
