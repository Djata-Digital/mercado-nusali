import { ApiResponse } from '../api/apiClient';
import { SupportApi } from '../api/clients/SupportApi';
import { API_CONFIG } from '../config/api';
import { mockSupportTicketsList } from '../data/mockAdminSupport';

export const SupportService = {
  async getTickets(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockSupportTicketsList };
    }
    return SupportApi.list();
  },

  async createTicket(subject: string, message: string): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: { id: 'TCK-' + Date.now(), subject, status: 'aberto' },
        message: 'Chamado de suporte aberto. Nossa equipe entrará em contato.',
      };
    }
    return SupportApi.create({ subject, message });
  }
};

