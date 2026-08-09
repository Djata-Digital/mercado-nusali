const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const p = (rel) => path.join(ROOT, rel);
const write = (rel, content) => {
  const file = p(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  console.log('[Sprint 7.5.6]', rel);
};

const base = 'apps/api/src/modules/financial-reconciliation';

if (!fs.existsSync(p(`${base}/financial-reconciliation-recovery.service.ts`))) {
  throw new Error('Sprint 7.5.5 não encontrada. Aplique a 7.5.5 antes da 7.5.6.');
}

write(`${base}/financial-reconciliation-recovery-audit.service.ts`, `import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  FinancialRecoveryAction,
  FinancialReconciliationRecoveryService,
} from './financial-reconciliation-recovery.service';

export type FinancialRecoveryRequestContext = {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

@Injectable()
export class FinancialReconciliationRecoveryAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recovery: FinancialReconciliationRecoveryService,
  ) {}

  async executeWithAudit(
    incidentId: string,
    action: FinancialRecoveryAction,
    context: FinancialRecoveryRequestContext,
    note?: string,
  ) {
    const before =
      await this.prisma.financialReconciliationIncident.findUnique({
        where: { id: incidentId },
      });

    if (!before) {
      throw new NotFoundException('Incidente financeiro não encontrado.');
    }

    try {
      const result = await this.recovery.execute(
        incidentId,
        action,
        context.actorId,
        note,
      );

      const after =
        await this.prisma.financialReconciliationIncident.findUnique({
          where: { id: incidentId },
        });

      await this.prisma.auditLog.create({
        data: {
          userId:
            context.actorId && context.actorId !== 'system'
              ? context.actorId
              : null,
          action: \`FINANCIAL_RECONCILIATION_RECOVERY_\${action}\`,
          entity: 'FinancialReconciliationIncident',
          entityId: incidentId,
          previousValue: this.safeJson({
            status: before.status,
            occurrenceCount: before.occurrenceCount,
            resolvedAt: before.resolvedAt,
            resolutionNote: before.resolutionNote,
          }),
          newValue: this.safeJson({
            success: true,
            idempotent: Boolean((result as any)?.idempotent),
            result,
            status: after?.status ?? before.status,
            note: note ?? null,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.auditLog.create({
        data: {
          userId:
            context.actorId && context.actorId !== 'system'
              ? context.actorId
              : null,
          action: \`FINANCIAL_RECONCILIATION_RECOVERY_\${action}_FAILED\`,
          entity: 'FinancialReconciliationIncident',
          entityId: incidentId,
          previousValue: this.safeJson({
            status: before.status,
            occurrenceCount: before.occurrenceCount,
          }),
          newValue: this.safeJson({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'UNKNOWN_RECOVERY_ERROR',
            note: note ?? null,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
        },
      });

      throw error;
    }
  }

  async history(incidentId: string, limit = 100) {
    const exists =
      await this.prisma.financialReconciliationIncident.findUnique({
        where: { id: incidentId },
        select: { id: true },
      });

    if (!exists) {
      throw new NotFoundException('Incidente financeiro não encontrado.');
    }

    return this.prisma.auditLog.findMany({
      where: {
        entity: 'FinancialReconciliationIncident',
        entityId: incidentId,
        action: {
          startsWith: 'FINANCIAL_RECONCILIATION_RECOVERY_',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      select: {
        id: true,
        userId: true,
        action: true,
        entity: true,
        entityId: true,
        previousValue: true,
        newValue: true,
        ipAddress: true,
        userAgent: true,
        requestId: true,
        createdAt: true,
      },
    });
  }

  private safeJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
`);

write(`${base}/financial-reconciliation-recovery-audit.service.spec.ts`, `import { FinancialReconciliationRecoveryAuditService } from './financial-reconciliation-recovery-audit.service';

describe('FinancialReconciliationRecoveryAuditService - Sprint 7.5.6', () => {
  function build() {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const recovery: any = {
      execute: jest.fn(),
    };

    return {
      prisma,
      recovery,
      service: new FinancialReconciliationRecoveryAuditService(
        prisma,
        recovery,
      ),
    };
  }

  it('registra before/after de recovery bem-sucedido', async () => {
    const { service, prisma, recovery } = build();

    prisma.financialReconciliationIncident.findUnique
      .mockResolvedValueOnce({
        id: 'inc-1',
        status: 'OPEN',
        occurrenceCount: 2,
        resolvedAt: null,
        resolutionNote: null,
      })
      .mockResolvedValueOnce({
        id: 'inc-1',
        status: 'RESOLVED',
        occurrenceCount: 2,
      });

    recovery.execute.mockResolvedValue({
      healthy: true,
      resolved: true,
      idempotent: false,
    });

    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await service.executeWithAudit(
      'inc-1',
      'AUTO_RESOLVE_IF_HEALTHY',
      {
        actorId: 'admin-1',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        requestId: 'req-1',
      },
      'validado',
    );

    expect(result.resolved).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin-1',
          action:
            'FINANCIAL_RECONCILIATION_RECOVERY_AUTO_RESOLVE_IF_HEALTHY',
          entity: 'FinancialReconciliationIncident',
          entityId: 'inc-1',
          requestId: 'req-1',
        }),
      }),
    );
  });

  it('registra tentativa falha antes de propagar o erro', async () => {
    const { service, prisma, recovery } = build();

    prisma.financialReconciliationIncident.findUnique.mockResolvedValue({
      id: 'inc-1',
      status: 'OPEN',
      occurrenceCount: 1,
    });

    recovery.execute.mockRejectedValue(
      new Error('recovery failed'),
    );

    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(
      service.executeWithAudit(
        'inc-1',
        'RECHECK',
        { actorId: 'admin-1' },
      ),
    ).rejects.toThrow('recovery failed');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'FINANCIAL_RECONCILIATION_RECOVERY_RECHECK_FAILED',
        }),
      }),
    );
  });

  it('histórico usa limite máximo de 500', async () => {
    const { service, prisma } = build();

    prisma.financialReconciliationIncident.findUnique.mockResolvedValue({
      id: 'inc-1',
    });
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.history('inc-1', 9999);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
  });

  it('actor system não é gravado como FK de usuário', async () => {
    const { service, prisma, recovery } = build();

    prisma.financialReconciliationIncident.findUnique
      .mockResolvedValueOnce({
        id: 'inc-1',
        status: 'OPEN',
        occurrenceCount: 1,
      })
      .mockResolvedValueOnce({
        id: 'inc-1',
        status: 'OPEN',
        occurrenceCount: 1,
      });

    recovery.execute.mockResolvedValue({
      healthy: false,
      resolved: false,
    });

    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await service.executeWithAudit(
      'inc-1',
      'RECHECK',
      { actorId: 'system' },
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: null }),
      }),
    );
  });
});
`);

write(`${base}/dto/financial-reconciliation-history.dto.ts`, `import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FinancialReconciliationHistoryQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
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
import { FinancialReconciliationRecoveryAuditService } from './financial-reconciliation-recovery-audit.service';
import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';

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
}
`);

write(`${base}/financial-reconciliation-admin-authorization.spec.ts`, `import 'reflect-metadata';

import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { FinancialReconciliationAdminController } from './financial-reconciliation-admin.controller';

describe('Financial Reconciliation Admin Authorization - Sprint 7.5.6', () => {
  it('protege o controller com permissão administrativa financeira', () => {
    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      FinancialReconciliationAdminController,
    );

    expect(permissions).toEqual(['payout:process:admin']);
  });
});
`);

write(`${base}/financial-reconciliation.module.ts`, `import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { FinancialReconciliationAdminController } from './financial-reconciliation-admin.controller';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';
import { FinancialReconciliationMetricsService } from './financial-reconciliation-metrics.service';
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
  ],
  exports: [
    FinancialReconciliationService,
    FinancialReconciliationIncidentsService,
    FinancialReconciliationMetricsService,
    FinancialReconciliationScanService,
    FinancialReconciliationRecoveryService,
    FinancialReconciliationRecoveryAuditService,
  ],
})
export class FinancialReconciliationModule {}
`);

console.log('[Sprint 7.5.6] aplicação concluída.');
console.log('[Sprint 7.5.6] Usa AuditLog existente. Nenhuma migration necessária.');
