import {
  apiClient,
  ApiResponse,
} from '../apiClient';

export class AdminFinanceApi {
  // ============================================================
  // REFUNDS
  // ============================================================

  static refundSummary(): Promise<
    ApiResponse<any>
  > {
    return apiClient.get(
      '/refunds/admin/operations/summary',
    );
  }

  static refundIssues(
    limit = 100,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/refunds/admin/operations/issues',
      {
        params: {
          limit,
        },
      },
    );
  }

  static refundInspect(
    refundId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/refunds/admin/operations/${refundId}`,
    );
  }

  static refundReconcile(
    refundId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/refunds/admin/operations/${refundId}/reconcile`,
      {},
    );
  }

  static refundReconcileStale(
    limit = 50,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      '/refunds/admin/operations/reconcile-stale',
      {
        limit,
      },
    );
  }

  static refundHistory(
    refundId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/refunds/admin/operations/${refundId}/history`,
    );
  }

  static refundReport(params?: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/refunds/admin/reports',
      {
        params,
      },
    );
  }

  static refundMetrics(): Promise<
    ApiResponse<any>
  > {
    return apiClient.get(
      '/refunds/admin/operations/metrics',
    );
  }

  static refundAlerts(): Promise<
    ApiResponse<any>
  > {
    return apiClient.get(
      '/refunds/admin/operations/alerts',
    );
  }

  // ============================================================
  // PAYOUTS
  // ============================================================

  static listPayouts(params?: {
    status?: string;
    sellerId?: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return apiClient.get(
      '/payouts/admin/all',
      {
        params,
      },
    );
  }

  static processPayout(
    payoutId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/payouts/${payoutId}/process`,
      {},
    );
  }

  static failPayout(
    payoutId: string,
    reason?: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/payouts/${payoutId}/fail`,
      {
        reason,
      },
    );
  }

  static reconcilePayout(
    payoutId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/payouts/${payoutId}/reconciliation`,
    );
  }

  static payoutReconciliationIssues(
    limit = 100,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/payouts/admin/reconciliation/issues',
      {
        params: {
          limit,
        },
      },
    );
  }

  // ============================================================
  // FINANCIAL RECONCILIATION
  // ============================================================

  static reconciliationSummary(): Promise<
    ApiResponse<any>
  > {
    return apiClient.get(
      '/admin/financial-reconciliation/summary',
    );
  }

  static reconciliationReadiness(): Promise<
    ApiResponse<any>
  > {
    return apiClient.get(
      '/admin/financial-reconciliation/readiness',
    );
  }

  static reconciliationMonitoring(): Promise<
    ApiResponse<any>
  > {
    return apiClient.get(
      '/admin/financial-reconciliation/monitoring',
    );
  }

  static reconciliationScheduler(): Promise<
    ApiResponse<any>
  > {
    return apiClient.get(
      '/admin/financial-reconciliation/scheduler',
    );
  }

  static reconciliationIncidents(
    limit = 100,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/admin/financial-reconciliation/incidents',
      {
        params: {
          limit,
        },
      },
    );
  }

  static acknowledgeIncident(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/admin/financial-reconciliation/incidents/${id}/acknowledge`,
      {},
    );
  }

  static resolveIncident(
    id: string,
    note?: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(
      `/admin/financial-reconciliation/incidents/${id}/resolve`,
      {
        note,
      },
    );
  }

  static incidentRecoveryHistory(
    id: string,
    limit = 100,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/admin/financial-reconciliation/incidents/${id}/recovery-history`,
      {
        params: {
          limit,
        },
      },
    );
  }

  static executeIncidentRecovery(
    id: string,
    action: string,
    note?: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/admin/financial-reconciliation/incidents/${id}/recovery`,
      {
        action,
        note,
      },
    );
  }

  static runReconciliationScan(
    limit = 100,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      '/admin/financial-reconciliation/scan',
      {
        limit,
      },
    );
  }

  static runReconciliationSchedulerOnce(): Promise<
    ApiResponse<any>
  > {
    return apiClient.post(
      '/admin/financial-reconciliation/scheduler/run-once',
      {},
    );
  }

  // ============================================================
  // SETTLEMENTS
  // ============================================================

  static listSettlementBatches(
    limit = 100,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/admin/settlements/batches',
      {
        params: {
          limit,
        },
      },
    );
  }

  static createSettlementBatch(data: {
    periodStart: string;
    periodEnd: string;
    currencyId: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.post(
      '/admin/settlements/batches',
      data,
    );
  }

  static getSettlementBatch(
    batchId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/admin/settlements/batches/${batchId}`,
    );
  }

  static closeSettlementBatch(
    batchId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/admin/settlements/batches/${batchId}/close`,
      {},
    );
  }

  static reconcileSettlementBatch(
    batchId: string,
    note?: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/admin/settlements/batches/${batchId}/reconcile`,
      {
        note,
      },
    );
  }

  static settlementFinalization(
    batchId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/admin/settlements/batches/${batchId}/finalization`,
    );
  }

  static settlementReport(
    batchId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/admin/settlements/batches/${batchId}/report`,
    );
  }

  static settlementBatchHistory(
    batchId: string,
    limit = 100,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/admin/settlements/batches/${batchId}/history`,
      {
        params: {
          limit,
        },
      },
    );
  }

  static settlementStatement(
    batchId: string,
    sellerId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/admin/settlements/batches/${batchId}/sellers/${sellerId}/statement`,
    );
  }

  static settlementEligibility(
    batchId: string,
    sellerId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/admin/settlements/batches/${batchId}/sellers/${sellerId}/eligibility`,
    );
  }

  static addSettlementAdjustment(
    batchId: string,
    sellerId: string,
    data: {
      amount: string;
      type: 'CREDIT' | 'DEBIT';
      reason: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/admin/settlements/batches/${batchId}/sellers/${sellerId}/adjustments`,
      data,
    );
  }

  static requestSettlementPayout(
    batchId: string,
    sellerId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/admin/settlements/batches/${batchId}/sellers/${sellerId}/payout`,
      {},
    );
  }

  static processSettlementPayout(
    settlementId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/admin/settlements/settlements/${settlementId}/payout/process`,
      {},
    );
  }

  static reconcileSettlementPayout(
    settlementId: string,
    note?: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/admin/settlements/settlements/${settlementId}/payout/reconcile`,
      {
        note,
      },
    );
  }

  static prepareSettlementRetry(
    settlementId: string,
    note?: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/admin/settlements/settlements/${settlementId}/recovery/prepare-retry`,
      {
        note,
      },
    );
  }

  static settlementHistory(
    settlementId: string,
    limit = 100,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/admin/settlements/settlements/${settlementId}/history`,
      {
        params: {
          limit,
        },
      },
    );
  }

  static settlementReadiness(): Promise<
    ApiResponse<any>
  > {
    return apiClient.get(
      '/admin/settlements/operations/readiness',
    );
  }

  static settlementMetrics(): Promise<
    ApiResponse<any>
  > {
    return apiClient.get(
      '/admin/settlements/operations/metrics',
    );
  }

  static settlementOperationalScan(): Promise<
    ApiResponse<any>
  > {
    return apiClient.post(
      '/admin/settlements/operations/scan',
      {},
    );
  }
}