import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  RiskAlert,
  RiskAlertStatus,
  RiskAlertType,
  RiskEntityType,
  RiskSeverity,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PayoutReconciliationService,
  PayoutReconciliationResult,
} from '../../payouts/services/payout-reconciliation.service';
import { RISK_CONFIG } from '../risk.config';
import { CreateRiskAlertDto } from '../dto/create-risk-alert.dto';

const ACTIVE_STATUSES: RiskAlertStatus[] = [
  RiskAlertStatus.OPEN,
  RiskAlertStatus.INVESTIGATING,
  RiskAlertStatus.BLOCKED,
  RiskAlertStatus.MONITORING,
];

@Injectable()
export class RiskDetectionService {
  private readonly logger = new Logger(RiskDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payoutReconciliationService: PayoutReconciliationService,
  ) {}

  async createAlert(dto: CreateRiskAlertDto): Promise<RiskAlert> {
    const dedupeKey =
      dto.dedupeKey ??
      (dto.ruleCode && dto.entityType && dto.entityId
        ? `${dto.ruleCode}:${dto.entityType}:${dto.entityId}`
        : undefined);

    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.riskAlert.create({
        data: {
          type: dto.type,
          severity: dto.severity,
          status: dto.status ?? RiskAlertStatus.OPEN,
          riskScore: dto.riskScore,
          entityType: dto.entityType,
          entityId: dto.entityId,
          userId: dto.userId,
          sellerId: dto.sellerId,
          orderId: dto.orderId,
          paymentId: dto.paymentId,
          payoutId: dto.payoutId,
          title: dto.title,
          description: dto.description,
          country: dto.country,
          source: dto.source ?? 'SYSTEM_DETECTION',
          ruleCode: dto.ruleCode,
          dedupeKey: dedupeKey,
          metadata: dto.metadata ?? undefined,
        },
      });

      await tx.riskAlertHistory.create({
        data: {
          riskAlertId: alert.id,
          action: 'ALERT_CREATED',
          note: 'Alerta gerado pelo serviço de detecção de risco.',
          newStatus: alert.status,
          metadata: { ruleCode: dto.ruleCode, riskScore: dto.riskScore, dedupeKey },
        },
      });

      this.logger.warn(
        `Alerta de risco criado [${alert.type}] id=${alert.id} rule=${alert.ruleCode} score=${alert.riskScore}`,
      );

      return alert;
    });
  }

  async createAlertIfNotExists(dto: CreateRiskAlertDto): Promise<RiskAlert> {
    const dedupeKey =
      dto.dedupeKey ??
      (dto.ruleCode && dto.entityType && dto.entityId
        ? `${dto.ruleCode}:${dto.entityType}:${dto.entityId}`
        : undefined);

    if (dedupeKey) {
      const existing = await this.prisma.riskAlert.findFirst({
        where: {
          dedupeKey: dedupeKey,
          status: { in: ACTIVE_STATUSES },
        },
      });

      if (existing) {
        this.logger.debug(
          `Alerta duplicado ativo ignorado [${dedupeKey}] id=${existing.id}`,
        );
        return existing;
      }
    }

    try {
      return await this.createAlert({ ...dto, dedupeKey });
    } catch (err: any) {
      // Capturar violacao de chave unica concorrente no PostgreSQL (P2002)
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        dedupeKey
      ) {
        this.logger.warn(
          `Concorrência de alerta evitada por constraint única [${dedupeKey}].`,
        );
        const existing = await this.prisma.riskAlert.findFirst({
          where: {
            dedupeKey: dedupeKey,
            status: { in: ACTIVE_STATUSES },
          },
        });
        if (existing) return existing;
      }
      throw err;
    }
  }

  // ==========================================
  // REGRA 1 — PAYOUT_RECONCILIATION
  // ==========================================
  async evaluatePayoutReconciliation(payoutId: string): Promise<RiskAlert | null> {
    if (!RISK_CONFIG.payoutReconciliation.enabled) {
      return null;
    }

    try {
      const reconciliation = await this.payoutReconciliationService.reconcileOne(
        payoutId,
      );

      return await this.evaluatePayoutReconciliationResult(reconciliation);
    } catch (err: any) {
      this.logger.error(
        `Erro ao avaliar reconciliação de payout id=${payoutId}: ${err.message}`,
      );
    }

    return null;
  }

  async evaluatePayoutReconciliationResult(
    result: PayoutReconciliationResult,
  ): Promise<RiskAlert | null> {
    if (!RISK_CONFIG.payoutReconciliation.enabled) {
      return null;
    }

    if (!result.consistent && result.issues && result.issues.length > 0) {
      const dedupeKey = `PAYOUT_RECONCILIATION_MISMATCH:${result.payoutId}`;

      return await this.createAlertIfNotExists({
        type: RiskAlertType.PAYOUT_RECONCILIATION,
        severity: RiskSeverity.CRITICAL,
        riskScore: RISK_CONFIG.payoutReconciliation.riskScore,
        entityType: RiskEntityType.PAYOUT,
        entityId: result.payoutId,
        payoutId: result.payoutId,
        ruleCode: 'PAYOUT_RECONCILIATION_MISMATCH',
        dedupeKey: dedupeKey,
        title: 'Inconsistência em Reconciliação de Payout',
        description: `Identificada divergência financeira no payout ${result.payoutId}: ${result.issues.join(', ')}`,
        metadata: {
          reconciliationIssues: result.issues,
          payoutStatus: result.status,
          reservationCount: result.reservationCount,
          payoutDebitCount: result.payoutDebitCount,
          ledgerCount: result.ledgerCount,
        },
      });
    }

    return null;
  }

  // ==========================================
  // REGRA 2 — HIGH_RISK_PAYOUT
  // ==========================================
  async evaluateHighRiskPayout(
    payoutId: string,
    amount: number,
    currencyCode: string,
  ): Promise<RiskAlert | null> {
    const config = RISK_CONFIG.highRiskPayout;
    if (!config.enabled) {
      return null;
    }

    const threshold = config.thresholdsByCurrency[currencyCode];
    if (threshold && amount >= threshold) {
      const dedupeKey = `HIGH_RISK_PAYOUT_AMOUNT:${payoutId}`;
      return await this.createAlertIfNotExists({
        type: RiskAlertType.HIGH_RISK_PAYOUT,
        severity: RiskSeverity.HIGH,
        riskScore: config.riskScore,
        entityType: RiskEntityType.PAYOUT,
        entityId: payoutId,
        payoutId: payoutId,
        ruleCode: 'HIGH_RISK_PAYOUT_AMOUNT',
        dedupeKey: dedupeKey,
        title: 'Payout de Alto Valor Detectado',
        description: `Payout de ${amount} ${currencyCode} ultrapassa o limite de risco estabelecido (${threshold} ${currencyCode}).`,
        metadata: { amount, currencyCode, threshold },
      });
    }

    return null;
  }

  // ==========================================
  // REGRA 3 — MULTIPLE_ACCOUNTS
  // ==========================================
  async evaluateMultipleAccounts(ipAddress?: string): Promise<RiskAlert | null> {
    const config = RISK_CONFIG.multipleAccounts;
    if (!config.enabled || !ipAddress) {
      return null;
    }

    const normalizedIp = this.normalizeIp(ipAddress);
    if (
      !normalizedIp ||
      normalizedIp === '127.0.0.1' ||
      normalizedIp === '::1' ||
      normalizedIp === 'localhost'
    ) {
      return null;
    }

    const sinceDate = new Date(
      Date.now() - config.windowHours * 60 * 60 * 1000,
    );

    const sessions = await this.prisma.session.findMany({
      where: {
        createdAt: { gte: sinceDate },
        OR: [{ ipAddress: normalizedIp }, { ipAddress: ipAddress }],
      },
      select: { userId: true },
    });

    const uniqueUserIds = Array.from(
      new Set(sessions.map((s) => s.userId).filter(Boolean)),
    );

    if (uniqueUserIds.length >= config.distinctUsersThreshold) {
      // Deduplicacao estavel baseada no hash do IP normalizado (nao depende da ordem dos userIds)
      const ipHash = crypto
        .createHash('sha256')
        .update(normalizedIp)
        .digest('hex')
        .substring(0, 16);
      const dedupeKey = `MULTIPLE_ACCOUNTS_SAME_IP:${ipHash}`;

      return await this.createAlertIfNotExists({
        type: RiskAlertType.MULTIPLE_ACCOUNTS,
        severity: RiskSeverity.HIGH,
        riskScore: config.riskScore,
        entityType: RiskEntityType.USER,
        entityId: uniqueUserIds[0],
        userId: uniqueUserIds[0],
        ruleCode: 'MULTIPLE_ACCOUNTS_SAME_IP',
        dedupeKey: dedupeKey,
        title: 'Múltiplas Contas Detectadas no Mesmo IP',
        description: `Detectadas ${uniqueUserIds.length} contas distintas acessando a partir do IP ${normalizedIp} nas últimas ${config.windowHours} horas.`,
        metadata: {
          ipAddress: normalizedIp,
          distinctUsersCount: uniqueUserIds.length,
          userIds: uniqueUserIds,
          windowHours: config.windowHours,
        },
      });
    }

    return null;
  }

  private normalizeIp(ip: string): string {
    let clean = ip.trim();
    if (clean.startsWith('::ffff:')) {
      clean = clean.replace('::ffff:', '');
    }
    return clean;
  }
}
