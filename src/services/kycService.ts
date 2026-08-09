import { ApiResponse } from '../api/apiClient';
import { AdminApi } from '../api/clients/AdminApi';
import { API_CONFIG } from '../config/api';
import { mockAdminKycList } from '../data/mockAdminKyc';

export const KycService = {
  async getPendingKyc(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockAdminKycList };
    }
    return AdminApi.filters();
  },

  async approveKyc(id: string): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: { id, status: 'verified' }, message: 'Documento KYC aprovado.' };
    }
    return AdminApi.update(id, { kycStatus: 'verified' });
  },

  async rejectKyc(id: string, reason: string): Promise<ApiResponse<any>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: { id, status: 'rejected', reason }, message: 'Documento KYC rejeitado.' };
    }
    return AdminApi.update(id, { kycStatus: 'rejected', reason });
  }
};

