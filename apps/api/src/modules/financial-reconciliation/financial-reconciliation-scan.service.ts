import { Injectable, Logger } from '@nestjs/common';
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
          `Falha ao reconciliar OrderGroup ${group.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
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
