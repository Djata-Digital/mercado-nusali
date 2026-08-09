import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { StockReservationsService } from './stock-reservations.service';

@Processor('stock-reservation-expiration')
@Injectable()
export class StockReservationExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(StockReservationExpirationProcessor.name);

  constructor(private readonly stockReservationsService: StockReservationsService) {
    super();
  }

  async process(job: Job<{ reservationId: string }>): Promise<any> {
    const { reservationId } = job.data;
    this.logger.log(`Processando expiração de reserva via BullMQ job ${job.id} (reserva: ${reservationId})`);

    try {
      const processed = await this.stockReservationsService.expireSingleReservation(reservationId);
      return { success: true, processed };
    } catch (err: any) {
      this.logger.error(`Erro ao processar expiração da reserva ${reservationId}: ${err.message}`);
      throw err;
    }
  }
}
