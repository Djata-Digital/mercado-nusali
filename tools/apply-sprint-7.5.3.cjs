const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function p(rel){ return path.join(ROOT, rel); }
function read(rel){ return fs.readFileSync(p(rel),'utf8'); }
function write(rel,s){ fs.mkdirSync(path.dirname(p(rel)),{recursive:true}); fs.writeFileSync(p(rel),s,'utf8'); console.log('[7.5.3] '+rel); }

const schemaRel='apps/api/prisma/schema.prisma';
let schema=read(schemaRel);
if(!schema.includes('model FinancialReconciliationIncident {')){
schema += `

enum FinancialReconciliationIncidentStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
}

enum FinancialReconciliationIncidentSeverity {
  WARNING
  CRITICAL
}

model FinancialReconciliationIncident {
  id              String   @id @default(uuid())
  fingerprint     String   @unique
  paymentId       String?
  orderGroupId    String
  code            String
  severity        FinancialReconciliationIncidentSeverity
  status          FinancialReconciliationIncidentStatus @default(OPEN)
  expectedValue   String?
  actualValue     String?
  detailsJson     Json?
  occurrenceCount Int      @default(1)
  firstSeenAt     DateTime @default(now())
  lastSeenAt      DateTime @default(now())
  acknowledgedAt DateTime?
  acknowledgedBy String?
  resolvedAt      DateTime?
  resolvedBy      String?
  resolutionNote  String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status, severity, lastSeenAt])
  @@index([orderGroupId, status])
  @@index([paymentId, status])
}
`;
write(schemaRel,schema);
}

const svcRel='apps/api/src/modules/financial-reconciliation/financial-reconciliation-incidents.service.ts';
write(svcRel, `import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FinancialReconciliationIncidentSeverity,
  FinancialReconciliationIncidentStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FinancialReconciliationService } from './financial-reconciliation.service';

@Injectable()
export class FinancialReconciliationIncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: FinancialReconciliationService,
  ) {}

  async reconcileAndPersistOrderGroup(orderGroupId: string) {
    const report = await this.reconciliation.reconcileOrderGroup(orderGroupId);
    const active: string[] = [];

    for (const payment of report.payments) {
      for (const issue of payment.issues) {
        const fingerprint = createHash('sha256')
          .update(\`\${orderGroupId}:\${payment.paymentId}:\${issue.code}\`)
          .digest('hex');
        active.push(fingerprint);

        await this.prisma.financialReconciliationIncident.upsert({
          where: { fingerprint },
          create: {
            fingerprint,
            paymentId: payment.paymentId,
            orderGroupId,
            code: issue.code,
            severity: this.severity(issue.code),
            expectedValue: issue.expected ?? null,
            actualValue: issue.actual ?? null,
            detailsJson: issue as unknown as Prisma.InputJsonValue,
          },
          update: {
            severity: this.severity(issue.code),
            expectedValue: issue.expected ?? null,
            actualValue: issue.actual ?? null,
            detailsJson: issue as unknown as Prisma.InputJsonValue,
            lastSeenAt: new Date(),
            occurrenceCount: { increment: 1 },
            status: FinancialReconciliationIncidentStatus.OPEN,
            resolvedAt: null,
            resolvedBy: null,
            resolutionNote: null,
          },
        });
      }
    }

    await this.prisma.financialReconciliationIncident.updateMany({
      where: {
        orderGroupId,
        status: { in: [
          FinancialReconciliationIncidentStatus.OPEN,
          FinancialReconciliationIncidentStatus.ACKNOWLEDGED,
        ]},
        ...(active.length ? { fingerprint: { notIn: active } } : {}),
      },
      data: {
        status: FinancialReconciliationIncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNote: 'AUTO_RESOLVED_BY_RECONCILIATION',
      },
    });

    return { ...report, persistedIncidentCount: active.length };
  }

  async list(take = 100) {
    return this.prisma.financialReconciliationIncident.findMany({
      orderBy: [{ severity: 'desc' }, { lastSeenAt: 'desc' }],
      take: Math.min(Math.max(take, 1), 500),
    });
  }

  async acknowledge(id: string, actorId: string) {
    await this.requireIncident(id);
    return this.prisma.financialReconciliationIncident.update({
      where: { id },
      data: {
        status: FinancialReconciliationIncidentStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedBy: actorId,
      },
    });
  }

  async resolve(id: string, actorId: string, note: string) {
    await this.requireIncident(id);
    return this.prisma.financialReconciliationIncident.update({
      where: { id },
      data: {
        status: FinancialReconciliationIncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy: actorId,
        resolutionNote: note,
      },
    });
  }

  async summary() {
    return this.prisma.financialReconciliationIncident.groupBy({
      by: ['status', 'severity'],
      _count: { _all: true },
    });
  }

  private async requireIncident(id: string) {
    const incident = await this.prisma.financialReconciliationIncident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incidente de reconciliação não encontrado.');
    return incident;
  }

  private severity(code: string) {
    const critical = new Set([
      'REFUND_EXCEEDS_PAYMENT',
      'ESCROW_INVARIANT_BROKEN',
      'PAYOUT_EXCEEDS_RELEASED',
      'REFUND_LEDGER_MISMATCH',
      'PAYOUT_LEDGER_MISMATCH',
    ]);
    return critical.has(code)
      ? FinancialReconciliationIncidentSeverity.CRITICAL
      : FinancialReconciliationIncidentSeverity.WARNING;
  }
}
`);

const specRel='apps/api/src/modules/financial-reconciliation/financial-reconciliation-incidents.service.spec.ts';
write(specRel, `import { FinancialReconciliationIncidentStatus } from '@prisma/client';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';

describe('FinancialReconciliationIncidentsService - Sprint 7.5.3', () => {
  const prisma: any = { financialReconciliationIncident: {
    upsert: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(),
    findUnique: jest.fn(), update: jest.fn(), groupBy: jest.fn(),
  }};
  const reconciliation: any = { reconcileOrderGroup: jest.fn() };
  let service: FinancialReconciliationIncidentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FinancialReconciliationIncidentsService(prisma, reconciliation);
  });

  it('persiste divergência com fingerprint idempotente', async () => {
    reconciliation.reconcileOrderGroup.mockResolvedValue({
      healthy:false, issueCount:1,
      payments:[{paymentId:'pay-1',issues:[{
        code:'REFUND_EXCEEDS_PAYMENT', expected:'100.00', actual:'120.00'
      }]}],
    });
    prisma.financialReconciliationIncident.upsert.mockResolvedValue({});
    prisma.financialReconciliationIncident.updateMany.mockResolvedValue({count:0});
    const result=await service.reconcileAndPersistOrderGroup('og-1');
    expect(result.persistedIncidentCount).toBe(1);
    expect(prisma.financialReconciliationIncident.upsert).toHaveBeenCalledTimes(1);
  });

  it('auto-resolve incidentes que desapareceram', async () => {
    reconciliation.reconcileOrderGroup.mockResolvedValue({healthy:true,issueCount:0,payments:[]});
    prisma.financialReconciliationIncident.updateMany.mockResolvedValue({count:1});
    await service.reconcileAndPersistOrderGroup('og-1');
    expect(prisma.financialReconciliationIncident.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({data:expect.objectContaining({
        status:FinancialReconciliationIncidentStatus.RESOLVED
      })})
    );
  });

  it('acknowledge registra o ator', async () => {
    prisma.financialReconciliationIncident.findUnique.mockResolvedValue({id:'i1'});
    prisma.financialReconciliationIncident.update.mockResolvedValue({status:'ACKNOWLEDGED'});
    await service.acknowledge('i1','admin-1');
    expect(prisma.financialReconciliationIncident.update).toHaveBeenCalledWith(
      expect.objectContaining({data:expect.objectContaining({acknowledgedBy:'admin-1'})})
    );
  });

  it('resolve registra ator e nota', async () => {
    prisma.financialReconciliationIncident.findUnique.mockResolvedValue({id:'i1'});
    prisma.financialReconciliationIncident.update.mockResolvedValue({status:'RESOLVED'});
    await service.resolve('i1','admin-1','corrigido');
    expect(prisma.financialReconciliationIncident.update).toHaveBeenCalledWith(
      expect.objectContaining({data:expect.objectContaining({
        resolvedBy:'admin-1',resolutionNote:'corrigido'
      })})
    );
  });

  it('limita listagem a 500', async () => {
    prisma.financialReconciliationIncident.findMany.mockResolvedValue([]);
    await service.list(9999);
    expect(prisma.financialReconciliationIncident.findMany)
      .toHaveBeenCalledWith(expect.objectContaining({take:500}));
  });
});
`);

const moduleRel='apps/api/src/modules/financial-reconciliation/financial-reconciliation.module.ts';
if(fs.existsSync(p(moduleRel))){
  let m=read(moduleRel);
  const importLine=`import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';`;

  if(!m.includes(importLine)){
    const anchor=`import { FinancialReconciliationService } from './financial-reconciliation.service';`;
    if(!m.includes(anchor)){
      throw new Error('Não foi possível localizar FinancialReconciliationService no module.');
    }
    m=m.replace(anchor, `${anchor}\n${importLine}`);
  }

  if(!m.includes('FinancialReconciliationIncidentsService]')){
    const providersAnchor='providers: [FinancialReconciliationService]';
    if(m.includes(providersAnchor)){
      m=m.replace(
        providersAnchor,
        'providers: [FinancialReconciliationService, FinancialReconciliationIncidentsService]'
      );
    } else if(!m.includes('FinancialReconciliationIncidentsService')){
      throw new Error('Não foi possível atualizar providers no financial-reconciliation.module.ts');
    }

    const exportsAnchor='exports: [FinancialReconciliationService]';
    if(m.includes(exportsAnchor)){
      m=m.replace(
        exportsAnchor,
        'exports: [FinancialReconciliationService, FinancialReconciliationIncidentsService]'
      );
    }
  }

  write(moduleRel,m);
}

const mig='apps/api/prisma/migrations/20260808180000_financial_reconciliation_incidents/migration.sql';
write(mig, `CREATE TYPE "FinancialReconciliationIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "FinancialReconciliationIncidentSeverity" AS ENUM ('WARNING', 'CRITICAL');

CREATE TABLE "FinancialReconciliationIncident" (
  "id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "paymentId" TEXT,
  "orderGroupId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "severity" "FinancialReconciliationIncidentSeverity" NOT NULL,
  "status" "FinancialReconciliationIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "expectedValue" TEXT,
  "actualValue" TEXT,
  "detailsJson" JSONB,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialReconciliationIncident_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialReconciliationIncident_fingerprint_key" ON "FinancialReconciliationIncident"("fingerprint");
CREATE INDEX "FinancialReconciliationIncident_status_severity_lastSeenAt_idx" ON "FinancialReconciliationIncident"("status","severity","lastSeenAt");
CREATE INDEX "FinancialReconciliationIncident_orderGroupId_status_idx" ON "FinancialReconciliationIncident"("orderGroupId","status");
CREATE INDEX "FinancialReconciliationIncident_paymentId_status_idx" ON "FinancialReconciliationIncident"("paymentId","status");
`);

console.log('[Sprint 7.5.3] aplicação concluída. Execute prisma generate e os testes.');
