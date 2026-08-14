import {
  apiClient,
  ApiResponse,
} from '../apiClient';

export type RiskAlertStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'BLOCKED'
  | 'RELEASED'
  | 'MONITORING'
  | 'RESOLVED'
  | 'FALSE_POSITIVE';

export type RiskSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type RiskAlertType =
  | 'SUSPICIOUS_PAYMENT'
  | 'MULTIPLE_ACCOUNTS'
  | 'DOCUMENT_INCONSISTENCY'
  | 'HIGH_RISK_PAYOUT'
  | 'NEW_SELLER_HIGH_VOLUME'
  | 'CHARGEBACK'
  | 'SUSPICIOUS_ADDRESS'
  | 'LOGISTICS_FRAUD'
  | 'COUNTERFEIT_SUSPECTED'
  | 'PAYOUT_RECONCILIATION'
  | 'ACCOUNT_TAKEOVER'
  | 'OTHER';

export type RiskEntityType =
  | 'USER'
  | 'SELLER'
  | 'STORE'
  | 'ORDER'
  | 'PAYMENT'
  | 'PAYOUT'
  | 'PRODUCT'
  | 'SHIPMENT';

export class AdminRiskApi {
  static list(params?: {
    page?: number;
    limit?: number;
    status?: RiskAlertStatus;
    severity?: RiskSeverity;
    type?: RiskAlertType;
    country?: string;
    entityType?: RiskEntityType;
    search?: string;
    minScore?: number;
    maxScore?: number;
  }): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/risk/admin/alerts',
      {
        params,
      },
    );
  }

  static get(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/risk/admin/alerts/${id}`,
    );
  }

  static updateStatus(
    id: string,
    data: {
      status: RiskAlertStatus;
      note?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(
      `/risk/admin/alerts/${id}/status`,
      data,
    );
  }

  static assign(
    id: string,
    data: {
      assignedToId: string;
      note?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(
      `/risk/admin/alerts/${id}/assign`,
      data,
    );
  }

  static resolve(
    id: string,
    data: {
      status:
        | 'RESOLVED'
        | 'FALSE_POSITIVE';
      resolution: string;
      note?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/risk/admin/alerts/${id}/resolve`,
      data,
    );
  }
}