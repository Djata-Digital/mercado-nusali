import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeForJson } from '../../common/utils/decimal.util';
import * as crypto from 'crypto';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async startOrGet(userId: string, scope: string, key: string, payload: any) {
    if (!key) {
      throw new BadRequestException('Header Idempotency-Key é obrigatório para esta operação.');
    }

    const requestHash = crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    try {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          userId_scope_key: { userId, scope, key },
        },
      });

      if (existing) {
        // Requirement 4: Tratar FAILED e expiração (expiresAt)
        const isExpired = existing.expiresAt < now;
        const isFailed = existing.status === 'FAILED';

        if (isExpired || isFailed) {
          // Allow safe retry by resetting FAILED or expired key to PROCESSING
          await this.prisma.idempotencyKey.update({
            where: { id: existing.id },
            data: {
              requestHash,
              status: 'PROCESSING',
              expiresAt,
              statusCode: null,
              responseJson: undefined,
            },
          });
          return { isCached: false };
        }

        // Active key validation
        if (existing.requestHash !== requestHash) {
          throw new ConflictException(
            'Chave de idempotência reutilizada com um payload diferente.',
            'IDEMPOTENCY_KEY_MISMATCH',
          );
        }

        if (existing.status === 'PROCESSING') {
          throw new ConflictException(
            'Uma requisição simultânea com esta mesma chave está em processamento.',
            'IDEMPOTENCY_KEY_LOCKED',
          );
        }

        if (existing.status === 'COMPLETED' && existing.responseJson) {
          return { isCached: true, statusCode: existing.statusCode || 200, data: existing.responseJson };
        }
      }

      // Create new key with PROCESSING status
      await this.prisma.idempotencyKey.create({
        data: {
          userId,
          scope,
          key,
          requestHash,
          status: 'PROCESSING',
          expiresAt,
        },
      });

      return { isCached: false };
    } catch (err: any) {
      if (err instanceof ConflictException || err instanceof BadRequestException) throw err;

      // Unique constraint collision means concurrent execution started it
      throw new ConflictException(
        'Uma requisição simultânea com esta mesma chave está em processamento.',
        'IDEMPOTENCY_KEY_LOCKED',
      );
    }
  }

  async complete(userId: string, scope: string, key: string, responseData: any, statusCode = 200) {
    const sanitizedResponse = sanitizeForJson(responseData);

    await this.prisma.idempotencyKey.update({
      where: {
        userId_scope_key: { userId, scope, key },
      },
      data: {
        status: 'COMPLETED',
        statusCode,
        responseJson: sanitizedResponse,
      },
    });
  }

  async fail(userId: string, scope: string, key: string) {
    try {
      await this.prisma.idempotencyKey.update({
        where: {
          userId_scope_key: { userId, scope, key },
        },
        data: {
          status: 'FAILED',
        },
      });
    } catch (e) {
      // Ignore if key was deleted
    }
  }
}
