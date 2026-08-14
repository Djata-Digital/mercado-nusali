import {
  apiClient,
  ApiResponse,
} from '../apiClient';

export type ReturnStatus =
  | 'REQUESTED'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'IN_TRANSIT'
  | 'RECEIVED_AT_HUB'
  | 'INSPECTING'
  | 'APPROVED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'CLOSED'
  | 'CANCELLED';

export class AdminReturnsApi {
  static list(params?: {
    status?: ReturnStatus;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return apiClient.get(
      '/returns/admin/all',
      {
        params,
      },
    );
  }

  static get(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/returns/admin/${id}`,
    );
  }

  static authorize(
    id: string,
    data?: {
      reverseTrackingCode?: string;
      carrierId?: string;
      returnWarehouseId?: string;
      note?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/returns/admin/${id}/authorize`,
      data || {},
    );
  }

  static reject(
    id: string,
    reason: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/returns/admin/${id}/reject`,
      {
        reason,
      },
    );
  }

  static markInTransit(
    id: string,
    note?: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/returns/admin/${id}/in-transit`,
      {
        note,
      },
    );
  }

  static receiveAtHub(
    id: string,
    note?: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/returns/admin/${id}/receive`,
      {
        note,
      },
    );
  }

  static startInspection(
    id: string,
    note?: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/returns/admin/${id}/start-inspection`,
      {
        note,
      },
    );
  }

  static inspect(
    id: string,
    data: {
      decision:
        | 'APPROVED'
        | 'REJECTED';

      notes?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/returns/admin/${id}/inspect`,
      data,
    );
  }

  static refund(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/returns/admin/${id}/refund`,
      {},
    );
  }

  static syncRefund(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/returns/admin/${id}/sync-refund`,
      {},
    );
  }
}