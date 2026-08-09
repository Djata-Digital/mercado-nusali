import { ApiResponse } from '../api/apiClient';
import { UsersApi } from '../api/clients/UsersApi';
import { API_CONFIG } from '../config/api';

export const CustomerService = {
  async getProfile(): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: {
          id: 'usr_001',
          name: 'Bacai Sanhá',
          email: 'bacai.sanha@nusali.cplp',
          cpfOrTaxId: '123.456.789-00',
          phone: '+245 955 123 456',
          country: 'GW',
        },
      };
    }
    return UsersApi.getById('me');
  },

  async updateProfile(data: any): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data, message: 'Perfil atualizado com sucesso!' };
    }
    return UsersApi.update('me', data);
  }
};

