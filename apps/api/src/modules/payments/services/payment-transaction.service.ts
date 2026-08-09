import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface PaymentTransactionOptions {
  maxRetries?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * PaymentTransactionService
 *
 * Padroniza transações financeiras críticas do módulo Payments.
 *
 * Regras:
 * - Serializable por padrão;
 * - retry somente para conflitos transacionais realmente transitórios;
 * - P2002 não recebe retry automático, pois normalmente representa uma regra de
 *   unicidade/idempotência que deve ser tratada pelo serviço de aplicação;
 * - após esgotar retries, retorna erro 409 estável.
 */
@Injectable()
export class PaymentTransactionService {
  private readonly defaultMaxRetries = 3;

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: PaymentTransactionOptions = {},
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
              'O pagamento foi alterado por outra operação. Tente novamente.',
            errorCode: 'PAYMENT_CONCURRENT_MODIFICATION',
          });
        }

        await this.waitBeforeRetry(attempt);
      }
    }

    throw new ConflictException({
      statusCode: 409,
      message: 'Não foi possível concluir a operação financeira.',
      errorCode: 'PAYMENT_CONCURRENT_MODIFICATION',
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
