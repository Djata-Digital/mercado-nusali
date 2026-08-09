import { ApiResponse } from '../api/apiClient';
import { ReturnsApi } from '../api/clients/ReturnsApi';
import { API_CONFIG } from '../config/api';

export const ReturnService = {
  async getReturns(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: [
          { id: 'RET-001', orderId: 'ORD-8810', buyer: 'Bacai Sanhá', seller: 'Moda Afro CPLP', tracking: 'RET-GW-901', status: 'Em Trânsito para HUB Bandim', date: '30/07 14:00' },
        ],
      };
    }
    return ReturnsApi.list();
  },

  async requestReturn(orderId: string, reason: string): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: { id: 'RET-' + Date.now(), orderId, reason, status: 'requested' },
        message: 'Logística reversa solicitada com sucesso!',
      };
    }
    return ReturnsApi.create({ orderId, reason });
  }
};

