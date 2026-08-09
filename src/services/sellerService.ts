import { ApiResponse } from '../api/apiClient';
import { SellerApi } from '../api/clients/SellerApi';
import { ProductsApi } from '../api/clients/ProductsApi';
import { OrdersApi } from '../api/clients/OrdersApi';
import { StoresApi } from '../api/clients/StoresApi';

export const SellerService = {
  async getProfile(): Promise<ApiResponse<any>> {
    return SellerApi.getMyProfile();
  },

  async getProducts(): Promise<ApiResponse<any>> {
    return ProductsApi.listMine({ page: 1, limit: 100 } as any);
  },

  async getOrders(): Promise<ApiResponse<any>> {
    return OrdersApi.listSeller();
  },

  async getFinancials(): Promise<ApiResponse<any>> {
    return {
      success: false,
      data: null,
      message: 'Financeiro Seller ainda não possui contrato real habilitado neste service.',
    };
  },

  async updateStore(storeData: any): Promise<ApiResponse<any>> {
    const storeId = storeData?.id;
    if (!storeId) {
      return {
        success: false,
        data: null,
        message: 'storeId real é obrigatório para atualizar a loja.',
      };
    }

    const { id, ...payload } = storeData;
    return StoresApi.updateMine(id, payload);
  },
};
