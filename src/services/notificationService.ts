import { ApiResponse } from '../api/apiClient';
import { NotificationsApi } from '../api/clients/NotificationsApi';
import { API_CONFIG } from '../config/api';
import { AppNotification } from '../types';

export const NotificationService = {
  async getNotifications(): Promise<ApiResponse<AppNotification[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: [
          {
            id: 'notif_1',
            title: 'Pagamento Protegido no Escrow',
            message: 'Seu pagamento de 42.500 XOF foi mantido em custódia até a entrega em Bissau.',
            type: 'payment',
            read: false,
            timestamp: 'Há 10 minutos',
          },
          {
            id: 'notif_2',
            title: 'Pacote Despachado do HUB Bandim',
            message: 'O pedido ORD-9200 está a caminho da zona de entrega em Gabú.',
            type: 'order',
            read: true,
            timestamp: 'Há 2 horas',
          },
        ],
      };
    }
    const res = await NotificationsApi.list();
    return {
      success: res.success,
      data: res.data?.items || (res.data as any) || [],
      message: res.message,
    };
  },

  async markAsRead(id: string): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: { id, read: true } };
    }
    return NotificationsApi.update(id, { read: true });
  }
};

