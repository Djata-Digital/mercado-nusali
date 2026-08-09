import { Controller, Get, Post, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { RefundsService } from './refunds.service';
import { RefundOperationsService } from './services/refund-operations.service';
import { RefundMetricsService } from './services/refund-metrics.service';
import { RefundAlertsService } from './services/refund-alerts.service';
import { RefundAuditReportService } from './services/refund-audit-report.service';
import { CreateRefundDto } from './dto/refund.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RefundAdminLimitQueryDto, RefundAdminReportQueryDto, RefundAdminReconcileStaleDto } from './dto/refund-admin.dto';
import { REFUND_ADMIN_PERMISSIONS } from './refund-admin.permissions';

@ApiTags('Refunds')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('refunds')
export class RefundsController {
  constructor(
    private readonly refundsService: RefundsService,
    private readonly refundOperations: RefundOperationsService,
    private readonly refundMetrics: RefundMetricsService,
    private readonly refundAlerts: RefundAlertsService,
    private readonly refundAudit: RefundAuditReportService,
  ) {}

  @Get()
  @Permissions('refund:read:self')
  @ApiOperation({ summary: 'Listar reembolsos do comprador autenticado' })
  async listBuyerRefunds(@Req() req: any) {
    const data = await this.refundsService.listBuyerRefunds(req.user.id);
    return { success: true, data };
  }

  @Post()
  @Permissions('refund:create:self')
  @ApiOperation({ summary: 'Solicitar e processar reembolso para um pedido' })
  async processRefund(@Req() req: any, @Body() dto: CreateRefundDto) {
    const data = await this.refundsService.processRefund(req.user.id, dto.paymentId, dto.orderId, dto.amount, dto.reason);
    return { success: true, data };
  }

  @Post(':id/retry')
  @Permissions('refund:create:self')
  @ApiOperation({ summary: 'Reprocessar reembolso pendente de confirmação' })
  async retryRefund(@Req() req: any, @Param('id') refundId: string) {
    const data = await this.refundsService.retryRefund(req.user.id, refundId);
    return { success: true, data };
  }


  @Get('admin/operations/summary')
  @Permissions(REFUND_ADMIN_PERMISSIONS.READ)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Resumo operacional de refunds para administração financeira' })
  async operationsSummary() {
    return {
      success: true,
      data: await this.refundOperations.summary(),
    };
  }

  @Get('admin/operations/issues')
  @Permissions(REFUND_ADMIN_PERMISSIONS.READ)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Listar refunds que exigem atenção operacional' })
  async operationsIssues(@Query() query: RefundAdminLimitQueryDto) {
    const limit = query.limit;
    return {
      success: true,
      data: await this.refundOperations.listIssues(limit),
    };
  }

  @Get('admin/operations/:id')
  @Permissions(REFUND_ADMIN_PERMISSIONS.READ)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Inspecionar refund e seu estado de reconciliação' })
  async inspectOperation(@Param('id') refundId: string) {
    return {
      success: true,
      data: await this.refundOperations.inspect(refundId),
    };
  }

  @Post('admin/operations/:id/reconcile')
  @Permissions(REFUND_ADMIN_PERMISSIONS.OPERATE)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Reconciliar manualmente um refund com proteção de lease/idempotência' })
  async reconcileOperation(@Param('id') refundId: string) {
    return {
      success: true,
      data: await this.refundOperations.reconcileOne(refundId),
    };
  }

  @Post('admin/operations/reconcile-stale')
  @Permissions(REFUND_ADMIN_PERMISSIONS.OPERATE)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Executar reconciliação controlada de refunds PROCESSING antigos' })
  async reconcileStale(@Body() body: RefundAdminReconcileStaleDto) {
    return {
      success: true,
      data: await this.refundOperations.reconcileStale(body.limit),
    };
  }

  @Get('admin/operations/:id/history')
  @Permissions(REFUND_ADMIN_PERMISSIONS.READ)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Histórico operacional e trilha de auditoria de um refund' })
  async refundHistory(@Param('id') refundId: string) {
    return { success: true, data: await this.refundAudit.history(refundId) };
  }

  @Get('admin/reports')
  @Permissions(REFUND_ADMIN_PERMISSIONS.REPORT)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Relatório operacional de refunds para auditoria financeira' })
  async refundReport(@Req() req: any, @Query() query: RefundAdminReportQueryDto) {
    const { from, to, limit } = query;
    const data = await this.refundAudit.report({ from, to, limit });
    await this.refundAudit.logAdminAction({ userId: req?.user?.id, action: 'REFUND_ADMIN_REPORT_EXPORT', newValue: { from: from?.toISOString(), to: to?.toISOString(), count: data.count } });
    return { success: true, data };
  }

  @Get('admin/operations/metrics')
  @Permissions(REFUND_ADMIN_PERMISSIONS.READ)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Métricas operacionais e SLA de refunds' })
  async refundMetricsSnapshot() {
    return {
      success: true,
      data: await this.refundMetrics.snapshot(),
    };
  }

  @Get('admin/operations/alerts')
  @Permissions(REFUND_ADMIN_PERMISSIONS.READ)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Alertas operacionais de refunds e webhooks' })
  async refundAlertsSnapshot() {
    return {
      success: true,
      data: await this.refundAlerts.evaluate(),
    };
  }
}
