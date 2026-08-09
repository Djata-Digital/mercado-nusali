import { Controller, Post, Get, Param, Body, Headers, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CarrierWebhookService } from './carrier-webhook.service';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CarrierWebhookStatus } from '@prisma/client';

@ApiTags('Logística - Webhooks')
@Controller()
export class CarrierWebhookController {
  constructor(private readonly webhookService: CarrierWebhookService) {}

  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Endpoint público para recepção de webhooks de transportadoras' })
  @ApiResponse({ status: 202, description: 'Webhook aceito e enfileirado com sucesso.' })
  @Post('logistics/webhooks/:carrierCode')
  async receiveWebhook(
    @Param('carrierCode') carrierCode: string,
    @Headers() headers: Record<string, any>,
    @Body() payload: any,
  ) {
    return this.webhookService.handleWebhook(carrierCode, headers, payload);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier_webhook:process')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar eventos de webhook na Dead Letter Queue (DLQ)' })
  @Get('admin/logistics/webhooks/dlq')
  async listDlqEvents(@Req() req: any) {
    return this.webhookService.listDlqEvents();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier_webhook:process')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reprocessar evento da DLQ de forma atômica' })
  @Post('admin/logistics/webhooks/dlq/:id/reprocess')
  async reprocessDlqEvent(@Req() req: any, @Param('id') id: string) {
    return this.webhookService.reprocessDlqEvent(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('carrier_webhook:process')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar evento de webhook na DLQ' })
  @Post('admin/logistics/webhooks/dlq/:id/cancel')
  async cancelDlqEvent(@Req() req: any, @Param('id') id: string) {
    return this.webhookService.cancelDlqEvent(id, req.user.id);
  }
}
