import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { WebhookStatus } from '@prisma/client';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
  ) {}

  async processWebhook(provider: string, eventId: string, eventType: string, headers: any, payload: any, signature?: string) {
    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });

    if (existing && existing.status === WebhookStatus.PROCESSED) {
      this.logger.warn(`Webhook duplicado recebido e ignorado. Provider: ${provider}, EventId: ${eventId}`);
      return {
        success: true,
        alreadyProcessed: true,
        data: existing.resultJson,
      };
    }

    const webhookRecord = existing
      ? existing
      : await this.prisma.webhookEvent.create({
          data: {
            provider,
            eventId,
            eventType,
            headersJson: headers,
            payloadJson: payload,
            signature,
            status: WebhookStatus.RECEIVED,
          },
        });

    const result = {
      processedAt: new Date(),
      status: 'SUCCESS',
      provider,
      eventId,
      eventType,
    };

    await this.prisma.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: {
        status: WebhookStatus.PROCESSED,
        processedAt: new Date(),
        resultJson: result,
      },
    });

    await this.outboxService.publishEvent('WebhookEvent', webhookRecord.id, `webhook.${eventType}`, {
      provider,
      eventId,
      eventType,
      payload,
    });

    return {
      success: true,
      alreadyProcessed: false,
      data: result,
    };
  }
}
