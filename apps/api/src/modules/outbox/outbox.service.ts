import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxStatus } from '@prisma/client';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async publishEvent(aggregateType: string, aggregateId: string, eventType: string, payload: any, txPrisma?: any) {
    const prismaTx = txPrisma || this.prisma;

    const event = await prismaTx.outboxEvent.create({
      data: {
        aggregateType,
        aggregateId,
        eventType,
        payloadJson: payload,
        status: OutboxStatus.PENDING,
      },
    });

    // Emit event asynchronously
    try {
      this.eventEmitter.emit(eventType, payload);
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
      });
    } catch (err: any) {
      this.logger.error(`Falha ao emitir evento ${eventType}: ${err.message}`);
    }

    return event;
  }

  async processPendingEvents() {
    const pendingEvents = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });

    for (const event of pendingEvents) {
      try {
        this.eventEmitter.emit(event.eventType, event.payloadJson);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() },
        });
      } catch (err: any) {
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxStatus.FAILED },
        });
      }
    }
  }
}
