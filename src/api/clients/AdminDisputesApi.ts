import {
  apiClient,
  ApiResponse,
} from '../apiClient';

export class AdminDisputesApi {
  static list(params?: {
    status?: 'OPEN' | 'RESOLVED';
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return apiClient.get(
      '/escrow/admin/disputes',
      {
        params,
      },
    );
  }

  static getByOrderId(
    orderId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/escrow/admin/disputes/${orderId}`,
    );
  }

  static addMessage(
    orderId: string,
    data: {
      message: string;
      isPrivate?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/escrow/admin/disputes/${orderId}/messages`,
      data,
    );
  }

  static resolve(
    orderId: string,
    data: {
      outcome:
        | 'BUYER_WINS'
        | 'SELLER_WINS';

      note?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/escrow/admin/disputes/${orderId}/resolve`,
      data,
    );
  }
}