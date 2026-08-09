import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateSettlementAdjustmentDto } from './dto/create-settlement-adjustment.dto';
import {
  SettlementAdminNoteDto,
  SettlementAuditHistoryQueryDto,
} from './dto/settlement-admin-operations.dto';
import { CreateSettlementBatchDto } from './dto/create-settlement-batch.dto';
import { SettlementBatchOperationsService } from './settlement-batch-operations.service';
import { SettlementPayoutService } from './settlement-payout.service';
import { SettlementRecoveryAuditService } from './settlement-recovery-audit.service';
import { SettlementReadinessService } from './settlement-readiness.service';
import { SettlementOperationalMonitorService } from './settlement-operational-monitor.service';
import { SettlementMetricsService } from './settlement-metrics.service';
import { SettlementsService } from './settlements.service';

@ApiTags('Settlements Admin')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('payout:process:admin')
@Controller('admin/settlements')
export class SettlementsController {
  constructor(
    private readonly settlements: SettlementsService,
    private readonly settlementPayouts: SettlementPayoutService,
    private readonly batchOperations: SettlementBatchOperationsService,
    private readonly recoveryAudit: SettlementRecoveryAuditService,
    private readonly readiness: SettlementReadinessService,
    private readonly metrics: SettlementMetricsService,
    private readonly operationalMonitor: SettlementOperationalMonitorService,
  ) {}

  @Post('batches')
  create(@Body() body: CreateSettlementBatchDto) {
    return this.settlements.createBatch({
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      currencyId: body.currencyId,
    });
  }

  @Get('batches/:id')
  getBatch(@Param('id') id: string) {
    return this.settlements.getBatch(id);
  }

  @Post('batches/:id/close')
  close(@Param('id') id: string) {
    return this.settlements.closeBatch(id);
  }

  @Post('batches/:id/reconcile')
  reconcileBatch(
    @Param('id') id: string,
    @Body() body: SettlementAdminNoteDto,
    @Req() req: any,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.recoveryAudit.reconcileBatchWithAudit(
      id,
      this.context(req, userAgent, requestId),
      body?.note,
    );
  }

  @Get('batches/:id/finalization')
  finalization(@Param('id') id: string) {
    return this.batchOperations.finalizationStatus(id);
  }

  @Get('batches/:id/report')
  report(@Param('id') id: string) {
    return this.batchOperations.report(id);
  }

  @Get('batches/:id/history')
  batchHistory(
    @Param('id') id: string,
    @Query() query: SettlementAuditHistoryQueryDto,
  ) {
    return this.recoveryAudit.batchHistory(
      id,
      query.limit ?? 100,
    );
  }

  @Get('batches/:batchId/sellers/:sellerId/statement')
  statement(
    @Param('batchId') batchId: string,
    @Param('sellerId') sellerId: string,
  ) {
    return this.settlements.sellerStatement(
      batchId,
      sellerId,
    );
  }

  @Post('batches/:batchId/sellers/:sellerId/adjustments')
  adjustment(
    @Param('batchId') batchId: string,
    @Param('sellerId') sellerId: string,
    @Body() body: CreateSettlementAdjustmentDto,
    @Req() req: any,
  ) {
    return this.settlements.addAdjustment({
      batchId,
      sellerId,
      amount: body.amount,
      type: body.type,
      reason: body.reason,
      createdBy: req?.user?.id ?? null,
    });
  }

  @Get('batches/:batchId/sellers/:sellerId/eligibility')
  eligibility(
    @Param('batchId') batchId: string,
    @Param('sellerId') sellerId: string,
  ) {
    return this.settlements.payoutEligibility(
      batchId,
      sellerId,
    );
  }

  @Post('batches/:batchId/sellers/:sellerId/payout')
  requestSettlementPayout(
    @Param('batchId') batchId: string,
    @Param('sellerId') sellerId: string,
  ) {
    return this.settlementPayouts.requestPayout(
      batchId,
      sellerId,
    );
  }

  @Post('settlements/:settlementId/payout/process')
  processSettlementPayout(
    @Param('settlementId') settlementId: string,
  ) {
    return this.settlementPayouts.processPayout(
      settlementId,
    );
  }

  @Post('settlements/:settlementId/payout/reconcile')
  reconcileSettlementPayout(
    @Param('settlementId') settlementId: string,
    @Body() body: SettlementAdminNoteDto,
    @Req() req: any,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.recoveryAudit.reconcileSettlementWithAudit(
      settlementId,
      this.context(req, userAgent, requestId),
      body?.note,
    );
  }

  @Post('settlements/:settlementId/recovery/prepare-retry')
  prepareRetry(
    @Param('settlementId') settlementId: string,
    @Body() body: SettlementAdminNoteDto,
    @Req() req: any,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.recoveryAudit.prepareRetry(
      settlementId,
      this.context(req, userAgent, requestId),
      body?.note,
    );
  }

  @Get('settlements/:settlementId/history')
  settlementHistory(
    @Param('settlementId') settlementId: string,
    @Query() query: SettlementAuditHistoryQueryDto,
  ) {
    return this.recoveryAudit.settlementHistory(
      settlementId,
      query.limit ?? 100,
    );
  }

  @Get('operations/readiness')
  readinessStatus() {
    return this.readiness.status();
  }

  @Get('operations/metrics')
  metricsSnapshot() {
    return this.metrics.snapshot();
  }

  @Post('operations/scan')
  operationalScan() {
    return this.operationalMonitor.scan();
  }

  private context(
    req: any,
    userAgent?: string,
    requestId?: string,
  ) {
    return {
      actorId: req?.user?.id ?? 'system',
      ipAddress: req?.ip,
      userAgent,
      requestId,
    };
  }
}
