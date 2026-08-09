import { ApiResponse } from '../api/apiClient';
import { DisputesApi } from '../api/clients/DisputesApi';
import { API_CONFIG } from '../config/api';
import { mockAdminDisputesList } from '../data/mockAdminDisputes';

export const DisputeService = {
  async getDisputes(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockAdminDisputesList };
    }
    const res = await DisputesApi.list();
    return {
      success: res.success,
      data: res.data?.items || (res.data as any) || [],
      message: res.message,
    };
  },

  async openDispute(orderId: string, reason: string, description: string): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: { id: 'DISP-' + Date.now(), orderId, reason, description, status: 'opened' },
        message: 'Reclamação/Disputa aberta com sucesso. Retenção Escrow mantida.',
      };
    }
    return DisputesApi.create({ orderId, reason, description });
  },

  async addMessage(disputeId: string, message: string): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: { disputeId, message, timestamp: new Date().toISOString() },
        message: 'Mensagem adicionada à sala de mediação.',
      };
    }
    return DisputesApi.addMessage(disputeId, message);
  }
};

