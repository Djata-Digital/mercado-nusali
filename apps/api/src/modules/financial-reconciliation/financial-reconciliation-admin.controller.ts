import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  FinancialIncidentListQueryDto,
  FinancialIncidentResolveDto,
  FinancialReconciliationScanDto,
} from './dto/financial-reconciliation-admin.dto';
import { FinancialReconciliationHistoryQueryDto } from './dto/financial-reconciliation-history.dto';
import { FinancialReconciliationRecoveryDto } from './dto/financial-reconciliation-recovery.dto';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';
import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';
import { FinancialReconciliationReadinessService } from './financial-reconciliation-readiness.service';
import { FinancialReconciliationRecoveryAuditService } from './financial-reconciliation-recovery-audit.service';
import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';
import { FinancialReconciliationSchedulerService } from './financial-reconciliation-scheduler.service';

@ApiTags('Financial Reconciliation Admin')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('payout:process:admin')
@Controller('admin/financial-reconciliation')
export class FinancialReconciliationAdminController {
  constructor(
    private readonly incidents: FinancialReconciliationIncidentsService,
    private readonly metrics: FinancialReconciliationMetricsService,
    private readonly scans: FinancialReconciliationScanService,
    private readonly recoveryAudit: FinancialReconciliationRecoveryAuditService,
    private readonly scheduler: FinancialReconciliationSchedulerService,
    private readonly readiness: FinancialReconciliationReadinessService,
  ) {}

  @Get('summary')
  summary() {
    return this.metrics.getSummary();
  }

  @Get('readiness')
  readinessCheck() {
    return this.readiness.check();
  }

  @Get('monitoring')
  monitoring() {
    return this.readiness.monitoring();
  }

  @Get('scheduler')
  schedulerStatus() {
    return this.scheduler.getStatus();
  }

  @Get('incidents')
  list(@Query() query: FinancialIncidentListQueryDto) {
    return this.incidents.list(query.limit ?? 100);
  }

  @Post('incidents/:id/acknowledge')
  acknowledge(@Param('id') id: string, @Req() req: any) {
    const actorId = req?.user?.id ?? 'system';
    return this.incidents.acknowledge(id, actorId);
  }

  @Patch('incidents/:id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() body: FinancialIncidentResolveDto,
    @Req() req: any,
  ) {
    const actorId = req?.user?.id ?? 'system';

    return this.incidents.resolve(
      id,
      actorId,
      body.note ?? 'Resolvido administrativamente',
    );
  }

  @Get('incidents/:id/recovery-history')
  recoveryHistory(
    @Param('id') id: string,
    @Query() query: FinancialReconciliationHistoryQueryDto,
  ) {
    return this.recoveryAudit.history(id, query.limit ?? 100);
  }

  @Post('incidents/:id/recovery')
  recoveryAction(
    @Param('id') id: string,
    @Body() body: FinancialReconciliationRecoveryDto,
    @Req() req: any,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const actorId = req?.user?.id ?? 'system';

    return this.recoveryAudit.executeWithAudit(
      id,
      body.action,
      {
        actorId,
        ipAddress: req?.ip,
        userAgent,
        requestId,
      },
      body.note,
    );
  }

  @Post('scan')
  scan(@Body() body: FinancialReconciliationScanDto) {
    return this.scans.scan(body.limit ?? 100);
  }

  @Post('scheduler/run-once')
  runSchedulerOnce() {
    return this.scheduler.runOnce();
  }
}
