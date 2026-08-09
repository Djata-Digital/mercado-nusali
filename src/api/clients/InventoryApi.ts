import { apiClient, ApiResponse } from '../apiClient';

export class InventoryApi {
  static list(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/inventory', { params });
  }

  static adjust(data: {
    variantId: string;
    warehouseId: string;
    newQuantity?: number;
    quantityDelta?: number;
    expectedQuantityAvailable?: number;
    reason?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.post('/inventory/adjust', data);
  }
}
