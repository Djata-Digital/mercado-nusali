import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StockReservationsService } from './stock-reservations.service';
import { StockReservationExpirationProcessor } from './stock-reservation-expiration.processor';

/**
 * As suítes E2E mockadas não devem abrir conexões Redis reais.
 * Em produção (e em testes reais com Redis), a variável não é definida e a
 * fila continua registrada normalmente.
 */
const bullMqWorkersEnabled = process.env.DISABLE_BULLMQ_WORKERS !== 'true';

@Module({
  imports: [
    ...(bullMqWorkersEnabled
      ? [
          BullModule.registerQueue({
            name: 'stock-reservation-expiration',
          }),
        ]
      : []),
  ],
  providers: [
    StockReservationsService,
    ...(bullMqWorkersEnabled ? [StockReservationExpirationProcessor] : []),
  ],
  exports: [
    StockReservationsService,
    ...(bullMqWorkersEnabled ? [BullModule] : []),
  ],
})
export class StockReservationsModule {}
