import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RiskDetectionService } from '../services/risk-detection.service';
import { PayoutReconciliationResult } from '../../payouts/services/payout-reconciliation.service';

export interface SessionCreatedEventPayload {
  userId: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
}

@Injectable()
export class RiskEventListener {
  private readonly logger = new Logger(RiskEventListener.name);

  constructor(private readonly riskDetectionService: RiskDetectionService) {}

  @OnEvent('auth.session.created')
  async handleSessionCreated(payload: SessionCreatedEventPayload) {
    try {
      if (payload?.ipAddress) {
        await this.riskDetectionService.evaluateMultipleAccounts(
          payload.ipAddress,
        );
      }
    } catch (err: any) {
      // Erro na avaliacao de risco NAO deve interromper ou impactar autenticacao
      this.logger.error(
        `Erro ao processar avaliação de risco para nova sessão [userId=${payload?.userId}]: ${err.message}`,
        err.stack,
      );
    }
  }

  @OnEvent('payout.reconciliation.completed')
  async handlePayoutReconciliationCompleted(
    payload: PayoutReconciliationResult,
  ) {
    try {
      if (payload && payload.payoutId) {
        await this.riskDetectionService.evaluatePayoutReconciliationResult(
          payload,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Erro ao processar resultado de reconciliação de payout [payoutId=${payload?.payoutId}]: ${err.message}`,
        err.stack,
      );
    }
  }
}
