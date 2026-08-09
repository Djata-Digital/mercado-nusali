import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProofOfDeliveryService } from './proof-of-delivery.service';

@Processor('pod-cleanup')
@Injectable()
export class PodCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(PodCleanupProcessor.name);

  constructor(private readonly podService: ProofOfDeliveryService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Executando job de expurgo de uploads temporários POD (${job.id})...`);
    const result = await this.podService.cleanupOrphanTempPodFiles();
    this.logger.log(`Job de expurgo concluído com sucesso. Registros limpos: ${result.cleanedCount}`);
    return result;
  }
}
