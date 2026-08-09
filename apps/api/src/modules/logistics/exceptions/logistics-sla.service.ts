import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogisticsSlaType } from '@prisma/client';

@Injectable()
export class LogisticsSlaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra um evento de atraso logístico de forma idempotente.
   */
  async recordSlaDelay(trackingId: string, type: LogisticsSlaType, expectedAt: Date, metadataJson?: Record<string, any>) {
    const existing = await this.prisma.logisticsSlaEvent.findUnique({
      where: { trackingId_type: { trackingId, type } },
    });

    if (existing) {
      return existing; // Idempotente: não cria atraso duplicado para o mesmo rastreamento e tipo
    }

    return this.prisma.logisticsSlaEvent.create({
      data: {
        trackingId,
        type,
        expectedAt,
        metadataJson: metadataJson as any,
      },
    });
  }
}
