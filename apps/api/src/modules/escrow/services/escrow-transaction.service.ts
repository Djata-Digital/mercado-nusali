import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface EscrowTransactionOptions {
  maxRetries?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Padroniza transações críticas do agregado Escrow.
 *
 * - Serializable por padrão;
 * - retry somente para conflitos transitórios PostgreSQL/Prisma;
 * - P2002 não recebe retry automático;
 * - conflitos persistentes viram erro 409 estável.
 */
@Injectable()
export class EscrowTransactionService {
  private readonly defaultMaxRetries = 3;

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: EscrowTransactionOptions = {},
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
              'A conta de Escrow foi alterada por outra operação. Tente novamente.',
            errorCode: 'ESCROW_CONCURRENT_MODIFICATION',
          });
        }

        await this.waitBeforeRetry(attempt);
      }
    }

    throw new ConflictException({
      statusCode: 409,
      message: 'Não foi possível concluir a operação de Escrow.',
      errorCode: 'ESCROW_CONCURRENT_MODIFICATION',
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
