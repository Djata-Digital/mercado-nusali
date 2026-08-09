import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface CheckoutTransactionOptions {
  maxRetries?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * CheckoutTransactionService
 *
 * Centraliza as transações do agregado Checkout.
 *
 * Regras:
 * - operações críticas utilizam isolamento Serializable;
 * - conflitos transitórios recebem retry controlado;
 * - todos os snapshots e eventos Outbox usam o mesmo TransactionClient;
 * - qualquer falha provoca rollback integral.
 */
@Injectable()
export class CheckoutTransactionService {
  private readonly defaultMaxRetries = 3;

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: CheckoutTransactionOptions = {},
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
    const isolationLevel =
      options.isolationLevel ?? Prisma.TransactionIsolationLevel.Serializable;

    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel });
      } catch (error: unknown) {
        attempt += 1;

        if (!this.isRetryableConflict(error) || attempt >= maxRetries) {
          if (this.isRetryableConflict(error)) {
            throw new ConflictException({
              statusCode: 409,
              message:
                'O checkout foi alterado por outra operação. Inicie ou confirme novamente.',
              errorCode: 'CHECKOUT_CONCURRENT_MODIFICATION',
            });
          }

          throw error;
        }

        await this.waitBeforeRetry(attempt);
      }
    }

    throw new ConflictException({
      statusCode: 409,
      message: 'Não foi possível concluir o checkout.',
      errorCode: 'CHECKOUT_CONCURRENT_MODIFICATION',
    });
  }

  private isRetryableConflict(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    return code === 'P2034' || code === '40001' || code === 'P2002';
  }

  private waitBeforeRetry(attempt: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 25 * attempt));
  }
}
