import {
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
