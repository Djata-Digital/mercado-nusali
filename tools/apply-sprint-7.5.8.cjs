const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const p = (rel) => path.join(ROOT, rel);
const write = (rel, content) => {
  const file = p(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  console.log('[Sprint 7.5.8]', rel);
};

const base = 'apps/api/src/modules/financial-reconciliation';

if (!fs.existsSync(p(`${base}/financial-reconciliation-recovery-audit.service.ts`))) {
  throw new Error('Sprint 7.5.6 não encontrada. Aplique as Sprints anteriores antes da 7.5.8.');
}

write(`${base}/financial-reconciliation-scheduler.service.ts`, `import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';

export type FinancialReconciliationSchedulerStatus = {
  enabled: boolean;
  running: boolean;
  totalRuns: number;
  skippedOverlaps: number;
  consecutiveFailures: number;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  intervalMs: number;
  batchSize: number;
};

@Injectable()
export class FinancialReconciliationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(
    FinancialReconciliationSchedulerService.name,
  );

  private timer?: NodeJS.Timeout;
  private running = false;
  private totalRuns = 0;
  private skippedOverlaps = 0;
  private consecutiveFailures = 0;
  private lastStartedAt: Date | null = null;
  private lastFinishedAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;

  constructor(private readonly scans: FinancialReconciliationScanService) {}

  onModuleInit() {
    if (!this.isEnabled()) return;

    const intervalMs = this.getIntervalMs();

    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);

    this.timer.unref?.();
  }

  async runOnce() {
    if (this.running) {
      this.skippedOverlaps += 1;
      this.logger.warn(
        'Scan financeiro ignorado porque uma execução anterior ainda está ativa.',
      );
      return {
        skipped: true,
        reason: 'PREVIOUS_RUN_STILL_ACTIVE',
      };
    }

    this.running = true;
    this.totalRuns += 1;
    this.lastStartedAt = new Date();

    try {
      const result = await this.scans.scan(this.getBatchSize());

      this.consecutiveFailures = 0;
      this.lastError = null;
      this.lastSuccessAt = new Date();

      return {
        skipped: false,
        result,
      };
    } catch (error) {
      this.consecutiveFailures += 1;
      this.lastError =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        \`Falha no scan financeiro agendado: \${this.lastError}\`,
      );

      throw error;
    } finally {
      this.lastFinishedAt = new Date();
      this.running = false;
    }
  }

  getStatus(): FinancialReconciliationSchedulerStatus {
    return {
      enabled: this.isEnabled(),
      running: this.running,
      totalRuns: this.totalRuns,
      skippedOverlaps: this.skippedOverlaps,
      consecutiveFailures: this.consecutiveFailures,
      lastStartedAt: this.lastStartedAt,
      lastFinishedAt: this.lastFinishedAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      intervalMs: this.getIntervalMs(),
      batchSize: this.getBatchSize(),
    };
  }

  private isEnabled() {
    return (
      process.env.FINANCIAL_RECONCILIATION_SCHEDULER_ENABLED === 'true'
    );
  }

  private getIntervalMs() {
    const parsed = Number(
      process.env.FINANCIAL_RECONCILIATION_INTERVAL_MS ?? '300000',
    );

    return Number.isFinite(parsed) && parsed >= 60000
      ? parsed
      : 300000;
  }

  private getBatchSize() {
    const parsed = Number(
      process.env.FINANCIAL_RECONCILIATION_BATCH_SIZE ?? '100',
    );

    if (!Number.isInteger(parsed) || parsed <= 0) return 100;

    return Math.min(parsed, 500);
  }
}
`);

write(`${base}/financial-reconciliation-readiness.service.ts`, `import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';
import { FinancialReconciliationSchedulerService } from './financial-reconciliation-scheduler.service';

@Injectable()
export class FinancialReconciliationReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: FinancialReconciliationMetricsService,
    private readonly scheduler: FinancialReconciliationSchedulerService,
  ) {}

  async check() {
    const checkedAt = new Date();

    let databaseReady = true;
    let databaseError: string | null = null;

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch (error) {
      databaseReady = false;
      databaseError =
        error instanceof Error ? error.message : String(error);
    }

    const [metrics, scheduler] = await Promise.all([
      this.metrics.getSummary(),
      Promise.resolve(this.scheduler.getStatus()),
    ]);

    const schedulerFresh = this.isSchedulerFresh(
      scheduler.enabled,
      scheduler.lastSuccessAt,
      scheduler.intervalMs,
    );

    const maxCritical = this.getCriticalIncidentThreshold();
    const criticalWithinThreshold =
      metrics.critical <= maxCritical;

    const ready =
      databaseReady &&
      schedulerFresh &&
      criticalWithinThreshold &&
      scheduler.consecutiveFailures <
        this.getSchedulerFailureThreshold();

    return {
      ready,
      checkedAt,
      checks: {
        database: {
          ready: databaseReady,
          error: databaseError,
        },
        scheduler: {
          ready:
            schedulerFresh &&
            scheduler.consecutiveFailures <
              this.getSchedulerFailureThreshold(),
          status: scheduler,
        },
        incidents: {
          ready: criticalWithinThreshold,
          critical: metrics.critical,
          maxCritical,
          summary: metrics,
        },
      },
    };
  }

  async monitoring() {
    const [metrics, readiness] = await Promise.all([
      this.metrics.getSummary(),
      this.check(),
    ]);

    return {
      generatedAt: new Date(),
      metrics,
      scheduler: this.scheduler.getStatus(),
      readiness,
    };
  }

  private isSchedulerFresh(
    enabled: boolean,
    lastSuccessAt: Date | null,
    intervalMs: number,
  ) {
    if (!enabled) return true;

    // Um worker recém-iniciado ainda é considerado pronto por até 2 intervalos.
    if (!lastSuccessAt) return true;

    const staleAfterMs = Math.max(
      intervalMs * 2,
      Number(
        process.env.FINANCIAL_RECONCILIATION_STALE_AFTER_MS ??
          intervalMs * 2,
      ),
    );

    return (
      Date.now() - new Date(lastSuccessAt).getTime() <=
      staleAfterMs
    );
  }

  private getCriticalIncidentThreshold() {
    const parsed = Number(
      process.env
        .FINANCIAL_RECONCILIATION_MAX_CRITICAL_INCIDENTS ?? '100',
    );

    return Number.isInteger(parsed) && parsed >= 0
      ? parsed
      : 100;
  }

  private getSchedulerFailureThreshold() {
    const parsed = Number(
      process.env
        .FINANCIAL_RECONCILIATION_MAX_CONSECUTIVE_FAILURES ?? '3',
    );

    return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
  }
}
`);

write(`${base}/financial-reconciliation-scheduler.service.spec.ts`, `import { FinancialReconciliationSchedulerService } from './financial-reconciliation-scheduler.service';

describe('FinancialReconciliationSchedulerService - Sprint 7.5.8', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FINANCIAL_RECONCILIATION_SCHEDULER_ENABLED =
      'true';
    process.env.FINANCIAL_RECONCILIATION_BATCH_SIZE = '25';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('registra sucesso e heartbeat operacional', async () => {
    const scans: any = {
      scan: jest.fn().mockResolvedValue({
        scanned: 2,
        healthy: 2,
        unhealthy: 0,
        failed: 0,
      }),
    };

    const service = new FinancialReconciliationSchedulerService(
      scans,
    );

    const result = await service.runOnce();
    const status = service.getStatus();

    expect(result.skipped).toBe(false);
    expect(status.totalRuns).toBe(1);
    expect(status.consecutiveFailures).toBe(0);
    expect(status.lastSuccessAt).toBeInstanceOf(Date);
    expect(status.lastError).toBeNull();
    expect(scans.scan).toHaveBeenCalledWith(25);
  });

  it('contabiliza falhas consecutivas', async () => {
    const scans: any = {
      scan: jest
        .fn()
        .mockRejectedValue(new Error('postgres unavailable')),
    };

    const service = new FinancialReconciliationSchedulerService(
      scans,
    );

    await expect(service.runOnce()).rejects.toThrow(
      'postgres unavailable',
    );

    const status = service.getStatus();
    expect(status.consecutiveFailures).toBe(1);
    expect(status.lastError).toBe('postgres unavailable');
  });

  it('impede scans sobrepostos', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    const scans: any = {
      scan: jest.fn().mockImplementation(async () => {
        await pending;
        return { scanned: 1 };
      }),
    };

    const service = new FinancialReconciliationSchedulerService(
      scans,
    );

    const first = service.runOnce();
    await Promise.resolve();

    const second = await service.runOnce();

    expect(second).toEqual({
      skipped: true,
      reason: 'PREVIOUS_RUN_STILL_ACTIVE',
    });
    expect(service.getStatus().skippedOverlaps).toBe(1);

    release();
    await first;
  });
});
`);

write(`${base}/financial-reconciliation-readiness.service.spec.ts`, `import { FinancialReconciliationReadinessService } from './financial-reconciliation-readiness.service';

describe('FinancialReconciliationReadinessService - Sprint 7.5.8', () => {
  function build(options?: {
    dbFails?: boolean;
    critical?: number;
    consecutiveFailures?: number;
  }) {
    const prisma: any = {
      $queryRawUnsafe: options?.dbFails
        ? jest.fn().mockRejectedValue(new Error('db down'))
        : jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const metrics: any = {
      getSummary: jest.fn().mockResolvedValue({
        total: options?.critical ?? 0,
        open: options?.critical ?? 0,
        acknowledged: 0,
        resolved: 0,
        warning: 0,
        critical: options?.critical ?? 0,
      }),
    };

    const scheduler: any = {
      getStatus: jest.fn().mockReturnValue({
        enabled: true,
        running: false,
        totalRuns: 1,
        skippedOverlaps: 0,
        consecutiveFailures:
          options?.consecutiveFailures ?? 0,
        lastStartedAt: new Date(),
        lastFinishedAt: new Date(),
        lastSuccessAt: new Date(),
        lastError: null,
        intervalMs: 300000,
        batchSize: 100,
      }),
    };

    return new FinancialReconciliationReadinessService(
      prisma,
      metrics,
      scheduler,
    );
  }

  it('fica ready quando banco, scheduler e incidentes estão saudáveis', async () => {
    const service = build();
    const result = await service.check();

    expect(result.ready).toBe(true);
    expect(result.checks.database.ready).toBe(true);
    expect(result.checks.scheduler.ready).toBe(true);
  });

  it('fica not-ready quando banco não responde', async () => {
    const service = build({ dbFails: true });
    const result = await service.check();

    expect(result.ready).toBe(false);
    expect(result.checks.database.ready).toBe(false);
  });

  it('fica not-ready após falhas consecutivas do scheduler', async () => {
    const service = build({ consecutiveFailures: 3 });
    const result = await service.check();

    expect(result.ready).toBe(false);
    expect(result.checks.scheduler.ready).toBe(false);
  });
});
`);

write(`${base}/financial-reconciliation-admin.controller.ts`, `import {
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
`);

write(`${base}/financial-reconciliation.module.ts`, `import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { FinancialReconciliationAdminController } from './financial-reconciliation-admin.controller';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';
import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';
import { FinancialReconciliationReadinessService } from './financial-reconciliation-readiness.service';
import { FinancialReconciliationRecoveryAuditService } from './financial-reconciliation-recovery-audit.service';
import { FinancialReconciliationRecoveryService } from './financial-reconciliation-recovery.service';
import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';
import { FinancialReconciliationSchedulerService } from './financial-reconciliation-scheduler.service';
import { FinancialReconciliationService } from './financial-reconciliation.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialReconciliationAdminController],
  providers: [
    FinancialReconciliationService,
    FinancialReconciliationIncidentsService,
    FinancialReconciliationMetricsService,
    FinancialReconciliationScanService,
    FinancialReconciliationRecoveryService,
    FinancialReconciliationRecoveryAuditService,
    FinancialReconciliationSchedulerService,
    FinancialReconciliationReadinessService,
  ],
  exports: [
    FinancialReconciliationService,
    FinancialReconciliationIncidentsService,
    FinancialReconciliationMetricsService,
    FinancialReconciliationScanService,
    FinancialReconciliationRecoveryService,
    FinancialReconciliationRecoveryAuditService,
    FinancialReconciliationSchedulerService,
    FinancialReconciliationReadinessService,
  ],
})
export class FinancialReconciliationModule {}
`);

console.log('[Sprint 7.5.8] aplicação concluída.');
console.log('[Sprint 7.5.8] Nenhuma migration necessária.');
