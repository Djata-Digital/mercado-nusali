import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RefundProviderWebhookDto } from './dto/refund-provider-webhook.dto';
import { RefundProviderWebhookService } from './services/refund-provider-webhook.service';

@ApiTags('Refund Provider Webhooks')
@Controller('refunds/provider-webhooks')
export class RefundProviderWebhookController {
  constructor(
    private readonly webhookService: RefundProviderWebhookService,
  ) {}

  @Post(':provider')
  @ApiOperation({
    summary: 'Receber confirmação assíncrona de refund do provider',
  })
  async receive(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() dto: RefundProviderWebhookDto,
  ) {
    const normalizedHeaders: Record<string, unknown> = { ...headers };

    const result = await this.webhookService.process(
      provider,
      dto.eventId,
      dto.eventType,
      normalizedHeaders,
      dto.payload,
      dto.signature,
    );

    return {
      success: true,
      data: result,
    };
  }
}
