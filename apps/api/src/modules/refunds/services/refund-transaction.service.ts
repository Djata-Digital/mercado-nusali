import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RefundTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        const code = (error as { code?: string } | null)?.code;
        if (code !== 'P2034' && code !== '40001') throw error;
        if (attempt === maxRetries) {
          throw new ConflictException({
            statusCode: 409,
            message: 'O reembolso foi alterado por outra operação. Tente novamente.',
            errorCode: 'REFUND_CONCURRENT_MODIFICATION',
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
      }
    }
    throw new ConflictException('Não foi possível concluir o reembolso.');
  }
}
