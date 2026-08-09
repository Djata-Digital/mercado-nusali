import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { CheckoutExpirationService } from '../services/checkout-expiration.service';

export const CHECKOUT_EXPIRATION_QUEUE = 'checkout-expiration';
export const PROCESS_EXPIRED_CHECKOUTS_JOB = 'process-expired-checkouts';

export interface CheckoutExpirationJobData {
  limit?: number;
}

/**
 * CheckoutExpirationProcessor
 *
 * Worker BullMQ responsável apenas por disparar o processamento de sessões
 * expiradas. Toda regra de negócio permanece no CheckoutExpirationService.
 *
 * A exceção nunca é absorvida aqui: em caso de falha ela é propagada para o
 * BullMQ, que aplicará attempts/backoff configurados no job.
 */
@Processor(CHECKOUT_EXPIRATION_QUEUE)
@Injectable()
export class CheckoutExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(CheckoutExpirationProcessor.name);

  constructor(
    private readonly checkoutExpirationService: CheckoutExpirationService,
  ) {
    super();
  }

  async process(job: Job<CheckoutExpirationJobData>): Promise<{
    processed: number;
    durationMs: number;
  }> {
    const startedAt = Date.now();
    const limit = this.normalizeLimit(job.data?.limit);

    this.logger.log(
      `Iniciando job ${job.name} (${job.id ?? 'sem-id'}) para até ${limit} checkouts.`,
    );

    try {
      const processed =
        await this.checkoutExpirationService.processExpiredSessions(limit);
      const durationMs = Date.now() - startedAt;

      this.logger.log(
        `Job ${job.name} concluído: ${processed} checkout(s) processado(s) em ${durationMs}ms.`,
      );

      return { processed, durationMs };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Falha no job ${job.name} após ${durationMs}ms: ${message}`,
      );

      // Importante: propagar a exceção permite que BullMQ aplique retry/backoff.
      throw error;
    }
  }

  private normalizeLimit(value?: number): number {
    if (!Number.isInteger(value) || !value || value <= 0) return 100;
    return Math.min(value, 500);
  }
}
