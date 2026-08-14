import {
  apiClient,
  ApiResponse,
} from '../apiClient';

export type SupportTicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type SupportTicketPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT';

export type SupportTicketCategory =
  | 'ORDER'
  | 'PAYMENT'
  | 'RETURN'
  | 'DISPUTE'
  | 'SELLER_ACCOUNT'
  | 'DELIVERY'
  | 'TECHNICAL'
  | 'OTHER';

export class AdminSupportApi {
  static list(params?: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    category?: SupportTicketCategory;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return apiClient.get(
      '/support/admin/tickets',
      {
        params,
      },
    );
  }

  static get(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/support/admin/tickets/${id}`,
    );
  }

  static assign(
    id: string,
    userId: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/support/admin/tickets/${id}/assign`,
      {
        userId,
      },
    );
  }

  static reply(
    id: string,
    data: {
      message: string;
      isInternal?: boolean;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      `/support/admin/tickets/${id}/messages`,
      data,
    );
  }

  static updateStatus(
    id: string,
    data: {
      status: SupportTicketStatus;
      reason?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(
      `/support/admin/tickets/${id}/status`,
      data,
    );
  }

  static updatePriority(
    id: string,
    priority: SupportTicketPriority,
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(
      `/support/admin/tickets/${id}/priority`,
      {
        priority,
      },
    );
  }
}