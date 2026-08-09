import { Injectable } from '@nestjs/common';
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
