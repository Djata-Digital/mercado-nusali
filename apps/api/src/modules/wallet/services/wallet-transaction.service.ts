import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface WalletTransactionOptions {
  maxRetries?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Boundary transacional para mutações financeiras da Wallet.
 *
 * - Serializable por padrão;
 * - retry apenas para conflitos transitórios do PostgreSQL/Prisma;
 * - conflito persistente vira 409 estável;
 * - nunca faz retry automático de violação de unicidade (P2002).
 */
@Injectable()
export class WalletTransactionService {
  private readonly defaultMaxRetries = 3;

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: WalletTransactionOptions = {},
  ): Promise<T> {
    const maxRetries = Math.max(1, options.maxRetries ?? this.defaultMaxRetries);
    const isolationLevel =
      options.isolationLevel ?? Prisma.TransactionIsolationLevel.Serializable;

    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel });
      } catch (error: unknown) {
        attempt += 1;

        if (!this.isRetryableConflict(error)) throw error;

        if (attempt >= maxRetries) {
          throw new ConflictException({
            statusCode: 409,
            message:
              'A carteira foi alterada por outra operação financeira. Tente novamente.',
            errorCode: 'WALLET_CONCURRENT_MODIFICATION',
          });
        }

        await this.waitBeforeRetry(attempt);
      }
    }

    throw new ConflictException({
      statusCode: 409,
      message: 'Não foi possível concluir a operação financeira da carteira.',
      errorCode: 'WALLET_CONCURRENT_MODIFICATION',
    });
  }

  private isRetryableConflict(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    return code === 'P2034' || code === '40001';
  }

  private waitBeforeRetry(attempt: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 25 * attempt));
  }
}
