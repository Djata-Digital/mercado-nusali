import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogisticsExceptionType, LogisticsExceptionStatus } from '@prisma/client';

export interface CreateLogisticsExceptionInput {
  shipmentId?: string;
  trackingId?: string;
  type: LogisticsExceptionType;
  severity?: string;
  title: string;
  description: string;
  reportedById?: string;
  metadataJson?: Record<string, any>;
}

@Injectable()
export class LogisticsExceptionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra uma exceção operacional (ex: Extravio, Avaria, Endereço não encontrado).
   * ISOLAMENTO FINANCEIRO: Não inicia reembolso nem movimentação de saldo nesta Sprint.
   */
  async createException(input: CreateLogisticsExceptionInput) {
    const exception = await this.prisma.logisticsException.create({
      data: {
        shipmentId: input.shipmentId,
        trackingId: input.trackingId,
        type: input.type,
        severity: input.severity || 'MEDIUM',
        status: LogisticsExceptionStatus.OPEN,
        title: input.title,
        description: input.description,
        reportedById: input.reportedById,
        metadataJson: input.metadataJson as any,
      },
    });

    // Gravar evento no Outbox para módulos futuros
    await this.prisma.outboxEvent.create({
      data: {
        aggregateType: 'LogisticsException',
        aggregateId: exception.id,
        eventType: 'logistics.exception.created',
        payloadJson: {
          exceptionId: exception.id,
          type: exception.type,
          severity: exception.severity,
          shipmentId: exception.shipmentId,
          trackingId: exception.trackingId,
        },
      },
    });

    return exception;
  }

  async resolveException(id: string, resolution: string, operatorId: string) {
    const exception = await this.prisma.logisticsException.findUnique({
      where: { id },
    });

    if (!exception) {
      throw new NotFoundException(`Exceção logística id '${id}' não encontrada.`);
    }

    return this.prisma.logisticsException.update({
      where: { id },
      data: {
        status: LogisticsExceptionStatus.RESOLVED,
        resolution,
        resolvedAt: new Date(),
        assignedToId: operatorId,
      },
    });
  }
}
