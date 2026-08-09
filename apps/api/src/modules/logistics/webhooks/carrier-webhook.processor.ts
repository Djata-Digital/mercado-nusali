import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { CarrierWebhookService } from './carrier-webhook.service';

@Processor('carrier-webhook-processing')
export class CarrierWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(CarrierWebhookProcessor.name);

  constructor(private readonly webhookService: CarrierWebhookService) {
    super();
  }

  async process(job: Job<{ eventId: string }>): Promise<any> {
    this.logger.log(`[BullMQ Processor] Processando evento de webhook ID: ${job.data.eventId} (Tentativa: ${job.attemptsMade + 1})`);
    await this.webhookService.processWebhookEvent(job.data.eventId);
  }
}
