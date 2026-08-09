import { Controller, Get, Post, Param, Body, Headers, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { PaymentIntentsService } from './payment-intents.service';
import { CreatePaymentIntentDto, ProcessPaymentDto, CapturePaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Payments')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentIntentsService: PaymentIntentsService,
  ) {}

  @Post('intent')
  @Permissions('payment:create:self')
  @ApiOperation({ summary: 'Criar intenção de pagamento (PaymentIntent) para um grupo de pedidos' })
  async createIntent(@Req() req: any, @Body() dto: CreatePaymentIntentDto) {
    const data = await this.paymentIntentsService.createIntent(req.user.id, dto.orderGroupId);
    return { success: true, data };
  }

  @Get('intent/:id')
  @Permissions('payment:read:self')
  @ApiOperation({ summary: 'Consultar intenção de pagamento por ID' })
  async getIntent(@Req() req: any, @Param('id') id: string) {
    const data = await this.paymentIntentsService.getIntentById(req.user.id, id);
    return { success: true, data };
  }

  @Post('process')
  @Permissions('payment:create:self')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Chave única de idempotência' })
  @ApiOperation({ summary: 'Processar pagamento selecionando o método/provedor desejado' })
  async processPayment(
    @Req() req: any,
    @Headers('Idempotency-Key') idempotencyKey: string,
    @Body() dto: ProcessPaymentDto,
  ) {
    const reqInfo = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
    return this.paymentsService.processPayment(req.user.id, dto, idempotencyKey, reqInfo);
  }

  @Post('capture')
  @Permissions('payment:capture:manage')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Chave única de idempotência' })
  @ApiOperation({ summary: 'Capturar pagamento autorizado e iniciar retenção em Escrow' })
  async capturePayment(
    @Req() req: any,
    @Headers('Idempotency-Key') idempotencyKey: string,
    @Body() dto: CapturePaymentDto,
  ) {
    const reqInfo = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
    return this.paymentsService.capturePayment(req.user.id, dto.paymentId, idempotencyKey, reqInfo);
  }

  @Get(':id')
  @Permissions('payment:read:self')
  @ApiOperation({ summary: 'Consultar detalhes do pagamento (com dados sanitizados de privacidade)' })
  async getPayment(@Req() req: any, @Param('id') id: string) {
    const data = await this.paymentsService.getPaymentById(req.user.id, id);
    return { success: true, data };
  }
}
