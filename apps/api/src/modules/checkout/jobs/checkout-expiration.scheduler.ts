import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  CHECKOUT_EXPIRATION_QUEUE,
  PROCESS_EXPIRED_CHECKOUTS_JOB,
} from './checkout-expiration.processor';

const CHECKOUT_EXPIRATION_REPEAT_MS = 60_000;
const CHECKOUT_EXPIRATION_JOB_ID = 'checkout-expiration-scheduler';

/**
 * CheckoutExpirationScheduler
 *
 * Registra um job repetível e idempotente para varrer CheckoutSessions
 * expiradas a cada minuto.
 *
 * O agendamento não executa regra de negócio e não processa checkouts em
 * memória. Se Redis estiver temporariamente indisponível durante o bootstrap,
 * registramos o erro e permitimos que a aplicação continue iniciando; o Redis
 * e o BullMQ continuam com suas próprias tentativas de reconexão.
 */
@Injectable()
export class CheckoutExpirationScheduler implements OnModuleInit {
  private readonly logger = new Logger(CheckoutExpirationScheduler.name);

  constructor(
    @InjectQueue(CHECKOUT_EXPIRATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.registerRepeatableJob();
      this.logger.log(
        `Job repetível ${PROCESS_EXPIRED_CHECKOUTS_JOB} registrado a cada ${CHECKOUT_EXPIRATION_REPEAT_MS / 1000}s.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Não fazemos fallback para execução local. O serviço HTTP pode subir e
      // a infraestrutura de fila poderá se recuperar/reconectar posteriormente.
      this.logger.error(
        `Não foi possível registrar o job de expiração no BullMQ: ${message}`,
      );
    }
  }

  async registerRepeatableJob(): Promise<void> {
    await this.queue.add(
      PROCESS_EXPIRED_CHECKOUTS_JOB,
      { limit: 100 },
      {
        jobId: CHECKOUT_EXPIRATION_JOB_ID,
        repeat: {
          every: CHECKOUT_EXPIRATION_REPEAT_MS,
        },
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3_000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }
}
