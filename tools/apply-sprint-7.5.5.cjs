const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const p = rel => path.join(ROOT, rel);
const write = (rel, content) => {
  const file = p(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  console.log('[Sprint 7.5.5]', rel);
};

const base = 'apps/api/src/modules/financial-reconciliation';

write(`${base}/financial-reconciliation-recovery.service.ts`, `import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';

export type FinancialRecoveryAction =
  | 'RECHECK'
  | 'AUTO_RESOLVE_IF_HEALTHY';

@Injectable()
export class FinancialReconciliationRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: FinancialReconciliationIncidentsService,
  ) {}

  async execute(
    incidentId: string,
    action: FinancialRecoveryAction,
    actorId: string,
    note?: string,
  ) {
    const incident =
      await this.prisma.financialReconciliationIncident.findUnique({
        where: { id: incidentId },
      });

    if (!incident) {
      throw new NotFoundException('Incidente financeiro não encontrado.');
    }

    if (incident.status === 'RESOLVED') {
      return {
        idempotent: true,
        incident,
        action,
      };
    }

    if (!['RECHECK', 'AUTO_RESOLVE_IF_HEALTHY'].includes(action)) {
      throw new BadRequestException(
        'Ação de recuperação financeira não suportada.',
      );
    }

    const result =
      await this.incidents.reconcileAndPersistOrderGroup(
        incident.orderGroupId,
      );

    if (action === 'AUTO_RESOLVE_IF_HEALTHY' && result.healthy) {
      const resolved = await this.incidents.resolve(
        incident.id,
        actorId,
        note ??
          'Auto-healing seguro: divergência não foi reproduzida após nova reconciliação.',
      );

      return {
        idempotent: false,
        action,
        healthy: true,
        resolved: true,
        incident: resolved,
      };
    }

    return {
      idempotent: false,
      action,
      healthy: result.healthy,
      resolved: false,
      reconciliation: result,
    };
  }
}
`);

write(`${base}/financial-reconciliation-recovery.service.spec.ts`, `import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FinancialReconciliationRecoveryService } from './financial-reconciliation-recovery.service';

describe('FinancialReconciliationRecoveryService - Sprint 7.5.5', () => {
  const incident = {
    id: 'inc-1',
    orderGroupId: 'og-1',
    status: 'OPEN',
  };

  it('faz RECHECK sem alterar dinheiro automaticamente', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(incident),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest.fn().mockResolvedValue({
        healthy: false,
        persistedIncidentCount: 1,
      }),
      resolve: jest.fn(),
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      incidents,
    );

    const result = await service.execute(
      'inc-1',
      'RECHECK',
      'admin-1',
    );

    expect(result.healthy).toBe(false);
    expect(result.resolved).toBe(false);
    expect(incidents.resolve).not.toHaveBeenCalled();
  });

  it('AUTO_RESOLVE_IF_HEALTHY resolve somente após reconciliação saudável', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(incident),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest.fn().mockResolvedValue({
        healthy: true,
        persistedIncidentCount: 0,
      }),
      resolve: jest.fn().mockResolvedValue({
        ...incident,
        status: 'RESOLVED',
      }),
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      incidents,
    );

    const result = await service.execute(
      'inc-1',
      'AUTO_RESOLVE_IF_HEALTHY',
      'admin-1',
      'validado',
    );

    expect(result.healthy).toBe(true);
    expect(result.resolved).toBe(true);
    expect(incidents.resolve).toHaveBeenCalledWith(
      'inc-1',
      'admin-1',
      'validado',
    );
  });

  it('não resolve automaticamente quando divergência continua', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(incident),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest.fn().mockResolvedValue({
        healthy: false,
        persistedIncidentCount: 1,
      }),
      resolve: jest.fn(),
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      incidents,
    );

    const result = await service.execute(
      'inc-1',
      'AUTO_RESOLVE_IF_HEALTHY',
      'admin-1',
    );

    expect(result.resolved).toBe(false);
    expect(incidents.resolve).not.toHaveBeenCalled();
  });

  it('é idempotente para incidente já resolvido', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue({
          ...incident,
          status: 'RESOLVED',
        }),
      },
    };

    const incidents: any = {
      reconcileAndPersistOrderGroup: jest.fn(),
      resolve: jest.fn(),
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      incidents,
    );

    const result = await service.execute(
      'inc-1',
      'RECHECK',
      'admin-1',
    );

    expect(result.idempotent).toBe(true);
    expect(
      incidents.reconcileAndPersistOrderGroup,
    ).not.toHaveBeenCalled();
  });

  it('rejeita incidente inexistente', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      {} as any,
    );

    await expect(
      service.execute('missing', 'RECHECK', 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita ação não suportada', async () => {
    const prisma: any = {
      financialReconciliationIncident: {
        findUnique: jest.fn().mockResolvedValue(incident),
      },
    };

    const service = new FinancialReconciliationRecoveryService(
      prisma,
      {} as any,
    );

    await expect(
      service.execute(
        'inc-1',
        'FORCE_LEDGER' as any,
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
`);

write(`${base}/dto/financial-reconciliation-recovery.dto.ts`, `import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class FinancialReconciliationRecoveryDto {
  @IsIn(['RECHECK', 'AUTO_RESOLVE_IF_HEALTHY'])
  action!: 'RECHECK' | 'AUTO_RESOLVE_IF_HEALTHY';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
`);

const controllerPath = `${base}/financial-reconciliation-admin.controller.ts`;
let controller = fs.readFileSync(p(controllerPath), 'utf8');

if (!controller.includes('FinancialReconciliationRecoveryService')) {
  controller = controller.replace(
    "import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';",
    "import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';\nimport { FinancialReconciliationRecoveryService } from './financial-reconciliation-recovery.service';\nimport { FinancialReconciliationRecoveryDto } from './dto/financial-reconciliation-recovery.dto';"
  );

  controller = controller.replace(
    'private readonly scans: FinancialReconciliationScanService,',
    'private readonly scans: FinancialReconciliationScanService,\n    private readonly recovery: FinancialReconciliationRecoveryService,'
  );

  controller = controller.replace(
    "\n  @Post('scan')",
    "\n  @Post('incidents/:id/recovery')\n  recoveryAction(\n    @Param('id') id: string,\n    @Body() body: FinancialReconciliationRecoveryDto,\n    @Req() req: any,\n  ) {\n    const actorId = req?.user?.id ?? 'system';\n    return this.recovery.execute(id, body.action, actorId, body.note);\n  }\n\n  @Post('scan')"
  );

  fs.writeFileSync(p(controllerPath), controller, 'utf8');
  console.log('[Sprint 7.5.5]', controllerPath);
}

const modulePath = `${base}/financial-reconciliation.module.ts`;
let moduleText = fs.readFileSync(p(modulePath), 'utf8');

if (!moduleText.includes('FinancialReconciliationRecoveryService')) {
  moduleText = moduleText.replace(
    "import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';",
    "import { FinancialReconciliationScanService } from './financial-reconciliation-scan.service';\nimport { FinancialReconciliationRecoveryService } from './financial-reconciliation-recovery.service';"
  );

  moduleText = moduleText.replace(
    'FinancialReconciliationScanService,\n    FinancialReconciliationSchedulerService,',
    'FinancialReconciliationScanService,\n    FinancialReconciliationRecoveryService,\n    FinancialReconciliationSchedulerService,'
  );

  moduleText = moduleText.replace(
    'FinancialReconciliationScanService,\n  ],',
    'FinancialReconciliationScanService,\n    FinancialReconciliationRecoveryService,\n  ],'
  );

  fs.writeFileSync(p(modulePath), moduleText, 'utf8');
  console.log('[Sprint 7.5.5]', modulePath);
}

console.log('[Sprint 7.5.5] aplicação concluída.');
console.log('[Sprint 7.5.5] Nenhuma migration necessária.');
