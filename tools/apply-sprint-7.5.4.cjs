const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const p = (rel) => path.join(ROOT, rel);
const write = (rel, content) => {
  const file = p(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  console.log('[Sprint 7.5.4 FIX]', rel);
};

const base = 'apps/api/src/modules/financial-reconciliation';

write(`${base}/dto/financial-reconciliation-admin.dto.ts`, `import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FinancialIncidentListQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class FinancialIncidentResolveDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class FinancialReconciliationScanDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
`);

write(`${base}/financial-reconciliation-metrics.service.ts`, `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinancialReconciliationMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const rows = await this.prisma.financialReconciliationIncident.groupBy({
      by: ['status', 'severity'],
      _count: { _all: true },
    });

    const summary = {
      total: 0,
      open: 0,
      acknowledged: 0,
      resolved: 0,
      warning: 0,
      critical: 0,
    };

    for (const row of rows) {
      const count = row._count._all;
      summary.total += count;

      if (row.status === 'OPEN') summary.open += count;
      if (row.status === 'ACKNOWLEDGED') summary.acknowledged += count;
      if (row.status === 'RESOLVED') summary.resolved += count;

      if (row.severity === 'WARNING') summary.warning += count;
      if (row.severity === 'CRITICAL') summary.critical += count;
    }

    return summary;
  }
}
`);

write(`${base}/financial-reconciliation-scan.service.ts`, `import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';

@Injectable()
export class FinancialReconciliationScanService {
  private readonly logger = new Logger(FinancialReconciliationScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: FinancialReconciliationIncidentsService,
  ) {}

  async scan(limit = 100) {
    const safeLimit = Math.min(Math.max(limit, 1), 500);

    const groups = await this.prisma.orderGroup.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: safeLimit,
    });

    let healthy = 0;
    let unhealthy = 0;
    let failed = 0;
    let persistedIncidentCount = 0;

    for (const group of groups) {
      try {
        const result = await this.incidents.reconcileAndPersistOrderGroup(
          group.id,
        );

        persistedIncidentCount += result.persistedIncidentCount ?? 0;

        if (result.healthy) healthy += 1;
        else unhealthy += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          \`Falha ao reconciliar OrderGroup \${group.id}: \${
            error instanceof Error ? error.message : String(error)
          }\`,
        );
      }
    }

    return {
      scanned: groups.length,
      healthy,
      unhealthy,
      failed,
      persistedIncidentCount,
    };
  }
}
`);

write(`${base}/financial-reconciliation-scheduler.service.ts`, `import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';

@Injectable()
export class FinancialReconciliationSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(
    FinancialReconciliationSchedulerService.name,
  );

  private timer?: NodeJS.Timeout;

  constructor(private readonly scans: FinancialReconciliationScanService) {}

  onModuleInit() {
    if (
      process.env.FINANCIAL_RECONCILIATION_SCHEDULER_ENABLED !== 'true'
    ) {
      return;
    }

    const intervalMs = Math.max(
      Number(
        process.env.FINANCIAL_RECONCILIATION_INTERVAL_MS ?? '300000',
      ),
      60000,
    );

    const batchSize = Math.min(
      Math.max(
        Number(
          process.env.FINANCIAL_RECONCILIATION_BATCH_SIZE ?? '100',
        ),
        1,
      ),
      500,
    );

    this.timer = setInterval(async () => {
      try {
        const result = await this.scans.scan(batchSize);
        this.logger.log(
          \`Scan financeiro concluído: \${JSON.stringify(result)}\`,
        );
      } catch (error) {
        this.logger.error(
          'Falha no scan financeiro agendado.',
          error instanceof Error ? error.stack : undefined,
        );
      }
    }, intervalMs);

    this.timer.unref?.();
  }
}
`);

write(`${base}/financial-reconciliation-admin.controller.ts`, `import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import {
  FinancialIncidentListQueryDto,
  FinancialIncidentResolveDto,
  FinancialReconciliationScanDto,
} from './dto/financial-reconciliation-admin.dto';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';
import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';
import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';

@Controller('admin/financial-reconciliation')
export class FinancialReconciliationAdminController {
  constructor(
    private readonly incidents: FinancialReconciliationIncidentsService,
    private readonly metrics: FinancialReconciliationMetricsService,
    private readonly scans: FinancialReconciliationScanService,
  ) {}

  @Get('summary')
  summary() {
    return this.metrics.getSummary();
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

  @Post('scan')
  scan(@Body() body: FinancialReconciliationScanDto) {
    return this.scans.scan(body.limit ?? 100);
  }
}
`);

write(`${base}/financial-reconciliation-metrics.service.spec.ts`, `import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';

describe('FinancialReconciliationMetricsService - Sprint 7.5.4', () => {
  it('agrega incidentes por status e severidade', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        groupBy: jest.fn().mockResolvedValue([
          {
            status: 'OPEN',
            severity: 'CRITICAL',
            _count: { _all: 2 },
          },
          {
            status: 'ACKNOWLEDGED',
            severity: 'WARNING',
            _count: { _all: 3 },
          },
          {
            status: 'RESOLVED',
            severity: 'WARNING',
            _count: { _all: 4 },
          },
        ]),
      },
    };

    const service = new FinancialReconciliationMetricsService(prisma);

    await expect(service.getSummary()).resolves.toEqual({
      total: 9,
      open: 2,
      acknowledged: 3,
      resolved: 4,
      warning: 7,
      critical: 2,
    });
  });
});
`);

write(`${base}/financial-reconciliation-scan.service.spec.ts`, `import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';

describe('FinancialReconciliationScanService - Sprint 7.5.4', () => {
  it('varre OrderGroups, persiste incidentes e limita lote a 500', async () => {
    const prisma: any = {
      orderGroup: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'og-1' }, { id: 'og-2' }]),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest
        .fn()
        .mockResolvedValueOnce({
          healthy: true,
          persistedIncidentCount: 0,
        })
        .mockResolvedValueOnce({
          healthy: false,
          persistedIncidentCount: 2,
        }),
    };

    const service = new FinancialReconciliationScanService(
      prisma,
      incidents,
    );

    await expect(service.scan(999)).resolves.toEqual({
      scanned: 2,
      healthy: 1,
      unhealthy: 1,
      failed: 0,
      persistedIncidentCount: 2,
    });

    expect(prisma.orderGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );

    expect(
      incidents.reconcileAndPersistOrderGroup,
    ).toHaveBeenCalledTimes(2);
  });

  it('continua o lote quando um OrderGroup falha', async () => {
    const prisma: any = {
      orderGroup: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'og-1' }, { id: 'og-2' }]),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest
        .fn()
        .mockRejectedValueOnce(new Error('falha simulada'))
        .mockResolvedValueOnce({
          healthy: true,
          persistedIncidentCount: 0,
        }),
    };

    const service = new FinancialReconciliationScanService(
      prisma,
      incidents,
    );

    const result = await service.scan(100);

    expect(result).toEqual({
      scanned: 2,
      healthy: 1,
      unhealthy: 0,
      failed: 1,
      persistedIncidentCount: 0,
    });
  });
});
`);

// Substitui o módulo por uma versão determinística, sem regex dinâmica.
write(`${base}/financial-reconciliation.module.ts`, `import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { FinancialReconciliationAdminController } from './financial-reconciliation-admin.controller';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';
import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';
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
    FinancialReconciliationSchedulerService,
  ],
  exports: [
    FinancialReconciliationService,
    FinancialReconciliationIncidentsService,
    FinancialReconciliationMetricsService,
    FinancialReconciliationScanService,
  ],
})
export class FinancialReconciliationModule {}
`);

console.log('[Sprint 7.5.4 FIX] aplicação concluída.');
console.log('[Sprint 7.5.4 FIX] Nenhuma migration necessária.');
