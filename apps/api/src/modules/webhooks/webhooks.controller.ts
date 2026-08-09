import { Controller, Post, Param, Body, Headers, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WebhookPayloadDto } from './dto/webhook.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Public()
  @Post(':provider')
  @HttpCode(200)
  @ApiOperation({ summary: 'Endpoint público para recebimento de webhooks de provedores financeiros' })
  async handleWebhook(
    @Param('provider') provider: string,
    @Headers() headers: any,
    @Body() dto: WebhookPayloadDto,
  ) {
    const signature = headers['x-signature'] || headers['stripe-signature'] || headers['x-hub-signature'];
    return this.webhooksService.processWebhook(provider, dto.eventId, dto.eventType, headers, dto.payload, signature);
  }
}
