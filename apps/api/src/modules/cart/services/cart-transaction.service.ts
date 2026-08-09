import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface CartTransactionOptions {
  maxRetries?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * CartTransactionService
 *
 * Centraliza a execução das transações do agregado Cart.
 *
 * Regras:
 * - operações de escrita usam isolamento Serializable;
 * - o mesmo TransactionClient é reutilizado por alterações e eventos Outbox;
 * - conflitos transitórios são repetidos de forma controlada;
 * - uma falha em qualquer etapa provoca rollback integral;
 * - o serviço não contém regras comerciais do carrinho.
 */
@Injectable()
export class CartTransactionService {
  private readonly defaultMaxRetries = 3;

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: CartTransactionOptions = {},
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
                'O carrinho foi alterado por outra operação. Tente novamente.',
              errorCode: 'CART_CONCURRENT_MODIFICATION',
            });
          }

          throw error;
        }

        await this.waitBeforeRetry(attempt);
      }
    }

    throw new ConflictException({
      statusCode: 409,
      message: 'Não foi possível concluir a alteração do carrinho.',
      errorCode: 'CART_CONCURRENT_MODIFICATION',
    });
  }

  private isRetryableConflict(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;

    // P2034: conflito/deadlock de transação Prisma.
    // 40001: serialization_failure nativo do PostgreSQL.
    // P2002: corrida de criação no índice único cartId + variantId.
    return code === 'P2034' || code === '40001' || code === 'P2002';
  }

  private waitBeforeRetry(attempt: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 25 * attempt));
  }
}
