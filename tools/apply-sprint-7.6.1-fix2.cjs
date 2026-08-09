const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const p = (rel) => path.join(ROOT, rel);
const write = (rel, content) => {
  const file = p(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  console.log('[Sprint 7.6.1 FIX]', rel);
};

const schemaAddition = "\nenum SettlementBatchStatus {\n  OPEN\n  PROCESSING\n  CLOSED\n  FAILED\n}\n\nenum SellerSettlementStatus {\n  PENDING\n  READY\n  SETTLED\n  FAILED\n}\n\nmodel SettlementBatch {\n  id          String                @id @default(cuid())\n  periodStart DateTime\n  periodEnd   DateTime\n  currencyId  String\n  status      SettlementBatchStatus @default(OPEN)\n  createdAt   DateTime              @default(now())\n  updatedAt   DateTime              @updatedAt\n  closedAt    DateTime?\n\n  settlements SellerSettlement[]\n\n  @@unique([periodStart, periodEnd, currencyId])\n  @@index([status, createdAt])\n}\n\nmodel SellerSettlement {\n  id             String                 @id @default(cuid())\n  batchId        String\n  sellerId       String\n  currencyId     String\n  grossAmount    Decimal                @db.Decimal(20, 4)\n  platformFee    Decimal                @db.Decimal(20, 4)\n  adjustments    Decimal                @default(0) @db.Decimal(20, 4)\n  payoutAmount   Decimal                @db.Decimal(20, 4)\n  status         SellerSettlementStatus @default(PENDING)\n  statementJson  Json?\n  createdAt      DateTime               @default(now())\n  updatedAt      DateTime               @updatedAt\n  settledAt      DateTime?\n\n  batch          SettlementBatch        @relation(fields: [batchId], references: [id], onDelete: Cascade)\n\n  @@unique([batchId, sellerId])\n  @@index([sellerId, status])\n  @@index([batchId, status])\n}\n";
const dto = "import { IsDateString, IsString, MinLength } from 'class-validator';\n\nexport class CreateSettlementBatchDto {\n  @IsDateString()\n  periodStart!: string;\n\n  @IsDateString()\n  periodEnd!: string;\n\n  @IsString()\n  @MinLength(1)\n  currencyId!: string;\n}\n";
const service = "import {\n  BadRequestException,\n  Injectable,\n  NotFoundException,\n} from '@nestjs/common';\nimport {\n  Prisma,\n  SettlementBatchStatus,\n  SellerSettlementStatus,\n} from '@prisma/client';\n\nimport { PrismaService } from '../prisma/prisma.service';\n\n@Injectable()\nexport class SettlementsService {\n  constructor(private readonly prisma: PrismaService) {}\n\n  async createBatch(input: {\n    periodStart: Date;\n    periodEnd: Date;\n    currencyId: string;\n  }) {\n    if (input.periodEnd <= input.periodStart) {\n      throw new BadRequestException(\n        'periodEnd deve ser posterior a periodStart.',\n      );\n    }\n\n    return this.prisma.settlementBatch.upsert({\n      where: {\n        periodStart_periodEnd_currencyId: {\n          periodStart: input.periodStart,\n          periodEnd: input.periodEnd,\n          currencyId: input.currencyId,\n        },\n      },\n      create: input,\n      update: {},\n    });\n  }\n\n  async getBatch(id: string) {\n    const batch = await this.prisma.settlementBatch.findUnique({\n      where: { id },\n      include: {\n        settlements: {\n          orderBy: { sellerId: 'asc' },\n        },\n      },\n    });\n\n    if (!batch) {\n      throw new NotFoundException('SettlementBatch n\u00e3o encontrado.');\n    }\n\n    return batch;\n  }\n\n  async closeBatch(id: string) {\n    return this.prisma.$transaction(\n      async (tx) => {\n        const batch = await tx.settlementBatch.findUnique({\n          where: { id },\n        });\n\n        if (!batch) {\n          throw new NotFoundException(\n            'SettlementBatch n\u00e3o encontrado.',\n          );\n        }\n\n        if (batch.status === SettlementBatchStatus.CLOSED) {\n          return tx.settlementBatch.findUnique({\n            where: { id },\n            include: { settlements: true },\n          });\n        }\n\n        if (batch.status !== SettlementBatchStatus.OPEN) {\n          throw new BadRequestException(\n            'Somente batches OPEN podem ser fechados.',\n          );\n        }\n\n        const claimed = await tx.settlementBatch.updateMany({\n          where: {\n            id,\n            status: SettlementBatchStatus.OPEN,\n          },\n          data: {\n            status: SettlementBatchStatus.PROCESSING,\n          },\n        });\n\n        if (claimed.count !== 1) {\n          throw new BadRequestException(\n            'O SettlementBatch foi alterado por outra opera\u00e7\u00e3o.',\n          );\n        }\n\n        const rows = await tx.$queryRaw<\n          Array<{\n            sellerId: string;\n            grossAmount: Prisma.Decimal;\n          }>\n        >(Prisma.sql`\n          SELECT\n            e.\"sellerId\" AS \"sellerId\",\n            COALESCE(SUM(e.\"releasedAmount\"), 0) AS \"grossAmount\"\n          FROM \"escrow_accounts\" e\n          WHERE e.\"releasedAmount\" > 0\n            AND e.\"currencyId\" = ${batch.currencyId}\n            AND e.\"updatedAt\" >= ${batch.periodStart}\n            AND e.\"updatedAt\" < ${batch.periodEnd}\n          GROUP BY e.\"sellerId\"\n        `);\n\n        for (const row of rows) {\n          const gross = new Prisma.Decimal(row.grossAmount);\n          const fee = new Prisma.Decimal(0);\n          const adjustments = new Prisma.Decimal(0);\n          const payout = gross.minus(fee).plus(adjustments);\n\n          await tx.sellerSettlement.upsert({\n            where: {\n              batchId_sellerId: {\n                batchId: id,\n                sellerId: row.sellerId,\n              },\n            },\n            create: {\n              batchId: id,\n              sellerId: row.sellerId,\n              currencyId: batch.currencyId,\n              grossAmount: gross,\n              platformFee: fee,\n              adjustments,\n              payoutAmount: payout,\n              status: SellerSettlementStatus.READY,\n              statementJson: {\n                grossAmount: gross.toFixed(4),\n                platformFee: fee.toFixed(4),\n                adjustments: adjustments.toFixed(4),\n                payoutAmount: payout.toFixed(4),\n              },\n            },\n            update: {},\n          });\n        }\n\n        await tx.settlementBatch.update({\n          where: { id },\n          data: {\n            status: SettlementBatchStatus.CLOSED,\n            closedAt: new Date(),\n          },\n        });\n\n        return tx.settlementBatch.findUnique({\n          where: { id },\n          include: {\n            settlements: {\n              orderBy: { sellerId: 'asc' },\n            },\n          },\n        });\n      },\n      {\n        isolationLevel:\n          Prisma.TransactionIsolationLevel.Serializable,\n      },\n    );\n  }\n\n  async sellerStatement(batchId: string, sellerId: string) {\n    const settlement =\n      await this.prisma.sellerSettlement.findUnique({\n        where: {\n          batchId_sellerId: { batchId, sellerId },\n        },\n      });\n\n    if (!settlement) {\n      throw new NotFoundException(\n        'Demonstrativo do vendedor n\u00e3o encontrado.',\n      );\n    }\n\n    return {\n      id: settlement.id,\n      batchId: settlement.batchId,\n      sellerId: settlement.sellerId,\n      currencyId: settlement.currencyId,\n      grossAmount: settlement.grossAmount.toString(),\n      platformFee: settlement.platformFee.toString(),\n      adjustments: settlement.adjustments.toString(),\n      payoutAmount: settlement.payoutAmount.toString(),\n      status: settlement.status,\n      statement: settlement.statementJson,\n      createdAt: settlement.createdAt,\n      settledAt: settlement.settledAt,\n    };\n  }\n}\n";
const controller = "import {\n  Body,\n  Controller,\n  Get,\n  Param,\n  Post,\n  UseGuards,\n} from '@nestjs/common';\nimport { ApiBearerAuth, ApiTags } from '@nestjs/swagger';\n\nimport { Permissions } from '../../common/decorators/permissions.decorator';\nimport { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';\nimport { PermissionsGuard } from '../../common/guards/permissions.guard';\nimport { CreateSettlementBatchDto } from './dto/create-settlement-batch.dto';\nimport { SettlementsService } from './settlements.service';\n\n@ApiTags('Settlements Admin')\n@ApiBearerAuth('JWT')\n@UseGuards(JwtAuthGuard, PermissionsGuard)\n@Permissions('payout:process:admin')\n@Controller('admin/settlements')\nexport class SettlementsController {\n  constructor(private readonly settlements: SettlementsService) {}\n\n  @Post('batches')\n  create(@Body() body: CreateSettlementBatchDto) {\n    return this.settlements.createBatch({\n      periodStart: new Date(body.periodStart),\n      periodEnd: new Date(body.periodEnd),\n      currencyId: body.currencyId,\n    });\n  }\n\n  @Get('batches/:id')\n  getBatch(@Param('id') id: string) {\n    return this.settlements.getBatch(id);\n  }\n\n  @Post('batches/:id/close')\n  close(@Param('id') id: string) {\n    return this.settlements.closeBatch(id);\n  }\n\n  @Get('batches/:batchId/sellers/:sellerId/statement')\n  statement(\n    @Param('batchId') batchId: string,\n    @Param('sellerId') sellerId: string,\n  ) {\n    return this.settlements.sellerStatement(\n      batchId,\n      sellerId,\n    );\n  }\n}\n";
const moduleFileContent = "import { Module } from '@nestjs/common';\n\nimport { PrismaModule } from '../prisma/prisma.module';\nimport { SettlementsController } from './settlements.controller';\nimport { SettlementsService } from './settlements.service';\n\n@Module({\n  imports: [PrismaModule],\n  controllers: [SettlementsController],\n  providers: [SettlementsService],\n  exports: [SettlementsService],\n})\nexport class SettlementsModule {}\n";
const spec = "import {\n  BadRequestException,\n  NotFoundException,\n} from '@nestjs/common';\nimport { Prisma } from '@prisma/client';\n\nimport { SettlementsService } from './settlements.service';\n\ndescribe('SettlementsService - Sprint 7.6.1', () => {\n  it('rejeita per\u00edodo inv\u00e1lido', async () => {\n    const service = new SettlementsService({} as any);\n\n    await expect(\n      service.createBatch({\n        periodStart: new Date('2026-08-08T10:00:00Z'),\n        periodEnd: new Date('2026-08-08T09:00:00Z'),\n        currencyId: 'BRL',\n      }),\n    ).rejects.toBeInstanceOf(BadRequestException);\n  });\n\n  it('cria batch de forma idempotente por per\u00edodo e moeda', async () => {\n    const prisma: any = {\n      settlementBatch: {\n        upsert: jest.fn().mockResolvedValue({\n          id: 'batch-1',\n        }),\n      },\n    };\n\n    const service = new SettlementsService(prisma);\n\n    await service.createBatch({\n      periodStart: new Date('2026-08-01T00:00:00Z'),\n      periodEnd: new Date('2026-08-08T00:00:00Z'),\n      currencyId: 'BRL',\n    });\n\n    expect(\n      prisma.settlementBatch.upsert,\n    ).toHaveBeenCalledTimes(1);\n  });\n\n  it('serializa dinheiro do statement como string', async () => {\n    const prisma: any = {\n      sellerSettlement: {\n        findUnique: jest.fn().mockResolvedValue({\n          id: 's-1',\n          batchId: 'b-1',\n          sellerId: 'seller-1',\n          currencyId: 'BRL',\n          grossAmount: new Prisma.Decimal('100.50'),\n          platformFee: new Prisma.Decimal('10.05'),\n          adjustments: new Prisma.Decimal('0'),\n          payoutAmount: new Prisma.Decimal('90.45'),\n          status: 'READY',\n          statementJson: {},\n          createdAt: new Date(),\n          settledAt: null,\n        }),\n      },\n    };\n\n    const service = new SettlementsService(prisma);\n\n    const result = await service.sellerStatement(\n      'b-1',\n      'seller-1',\n    );\n\n    expect(result.grossAmount).toBe('100.5');\n    expect(result.platformFee).toBe('10.05');\n    expect(result.payoutAmount).toBe('90.45');\n  });\n\n  it('rejeita statement inexistente', async () => {\n    const prisma: any = {\n      sellerSettlement: {\n        findUnique: jest.fn().mockResolvedValue(null),\n      },\n    };\n\n    const service = new SettlementsService(prisma);\n\n    await expect(\n      service.sellerStatement('b-1', 'seller-404'),\n    ).rejects.toBeInstanceOf(NotFoundException);\n  });\n});\n";
const migration = "CREATE TYPE \"SettlementBatchStatus\" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED', 'FAILED');\nCREATE TYPE \"SellerSettlementStatus\" AS ENUM ('PENDING', 'READY', 'SETTLED', 'FAILED');\n\nCREATE TABLE \"SettlementBatch\" (\n  \"id\" TEXT NOT NULL,\n  \"periodStart\" TIMESTAMP(3) NOT NULL,\n  \"periodEnd\" TIMESTAMP(3) NOT NULL,\n  \"currencyId\" TEXT NOT NULL,\n  \"status\" \"SettlementBatchStatus\" NOT NULL DEFAULT 'OPEN',\n  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  \"updatedAt\" TIMESTAMP(3) NOT NULL,\n  \"closedAt\" TIMESTAMP(3),\n  CONSTRAINT \"SettlementBatch_pkey\" PRIMARY KEY (\"id\")\n);\n\nCREATE TABLE \"SellerSettlement\" (\n  \"id\" TEXT NOT NULL,\n  \"batchId\" TEXT NOT NULL,\n  \"sellerId\" TEXT NOT NULL,\n  \"currencyId\" TEXT NOT NULL,\n  \"grossAmount\" DECIMAL(20,4) NOT NULL,\n  \"platformFee\" DECIMAL(20,4) NOT NULL,\n  \"adjustments\" DECIMAL(20,4) NOT NULL DEFAULT 0,\n  \"payoutAmount\" DECIMAL(20,4) NOT NULL,\n  \"status\" \"SellerSettlementStatus\" NOT NULL DEFAULT 'PENDING',\n  \"statementJson\" JSONB,\n  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  \"updatedAt\" TIMESTAMP(3) NOT NULL,\n  \"settledAt\" TIMESTAMP(3),\n  CONSTRAINT \"SellerSettlement_pkey\" PRIMARY KEY (\"id\")\n);\n\nCREATE UNIQUE INDEX \"SettlementBatch_periodStart_periodEnd_currencyId_key\"\nON \"SettlementBatch\"(\"periodStart\", \"periodEnd\", \"currencyId\");\n\nCREATE INDEX \"SettlementBatch_status_createdAt_idx\"\nON \"SettlementBatch\"(\"status\", \"createdAt\");\n\nCREATE UNIQUE INDEX \"SellerSettlement_batchId_sellerId_key\"\nON \"SellerSettlement\"(\"batchId\", \"sellerId\");\n\nCREATE INDEX \"SellerSettlement_sellerId_status_idx\"\nON \"SellerSettlement\"(\"sellerId\", \"status\");\n\nCREATE INDEX \"SellerSettlement_batchId_status_idx\"\nON \"SellerSettlement\"(\"batchId\", \"status\");\n\nALTER TABLE \"SellerSettlement\"\nADD CONSTRAINT \"SellerSettlement_batchId_fkey\"\nFOREIGN KEY (\"batchId\") REFERENCES \"SettlementBatch\"(\"id\")\nON DELETE CASCADE ON UPDATE CASCADE;\n";

const schemaRel = 'apps/api/prisma/schema.prisma';
let schema = fs.readFileSync(p(schemaRel), 'utf8');

if (!schema.includes('model SettlementBatch {')) {
  schema += '\n' + schemaAddition;
  fs.writeFileSync(p(schemaRel), schema, 'utf8');
  console.log('[Sprint 7.6.1 FIX]', schemaRel);
} else {
  console.log('[Sprint 7.6.1 FIX] schema já contém SettlementBatch.');
}

write(
  'apps/api/src/modules/settlements/dto/create-settlement-batch.dto.ts',
  dto,
);
write(
  'apps/api/src/modules/settlements/settlements.service.ts',
  service,
);
write(
  'apps/api/src/modules/settlements/settlements.controller.ts',
  controller,
);
write(
  'apps/api/src/modules/settlements/settlements.module.ts',
  moduleFileContent,
);
write(
  'apps/api/src/modules/settlements/settlements.service.spec.ts',
  spec,
);
write(
  'apps/api/prisma/migrations/20260808190000_settlement_batch_core/migration.sql',
  migration,
);

const appRel = 'apps/api/src/app.module.ts';
let app = fs.readFileSync(p(appRel), 'utf8');

const importLine =
  "import { SettlementsModule } from './modules/settlements/settlements.module';";

if (!app.includes(importLine)) {
  const anchor =
    "import { FinancialReconciliationModule } from './modules/financial-reconciliation/financial-reconciliation.module';";
  if (!app.includes(anchor)) {
    throw new Error(
      'FinancialReconciliationModule não encontrado em app.module.ts.',
    );
  }
  app = app.replace(anchor, anchor + '\n' + importLine);
}

const sprint4Anchor = '    FinancialReconciliationModule,';
if (!app.includes('    SettlementsModule,')) {
  if (!app.includes(sprint4Anchor)) {
    throw new Error(
      'FinancialReconciliationModule não encontrado no imports do @Module.',
    );
  }
  app = app.replace(
    sprint4Anchor,
    sprint4Anchor + '\n    SettlementsModule,',
  );
}

fs.writeFileSync(p(appRel), app, 'utf8');
console.log('[Sprint 7.6.1 FIX]', appRel);

console.log('[Sprint 7.6.1 FIX] aplicação concluída.');
console.log('[Sprint 7.6.1 FIX] Execute npx prisma generate.');
console.log(
  '[Sprint 7.6.1 FIX] No banco de desenvolvimento, use db execute + migrate resolve conforme README.',
);
