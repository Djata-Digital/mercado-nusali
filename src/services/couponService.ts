import { apiClient, ApiResponse } from '../api/apiClient';
import { API_CONFIG } from '../config/api';

export const CouponService = {
  async validateCoupon(code: string): Promise<ApiResponse<{ discountPercentage: number; code: string }>> {
    if (API_CONFIG.USE_FAKE_API) {
      if (code.toUpperCase() === 'NUSALI10' || code.toUpperCase() === 'BISSAU2026') {
        return {
          success: true,
          data: { discountPercentage: 10, code: code.toUpperCase() },
          message: 'Cupom de 10% OFF aplicado com sucesso!',
        };
      }
      return { success: false, data: null as any, message: 'Cupom inválido ou expirado.' };
    }
    return apiClient.post('/coupons/validate', { code });
  }
};

