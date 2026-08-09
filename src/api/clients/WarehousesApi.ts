import { apiClient, ApiResponse } from '../apiClient';

export class WarehousesApi {
  static listMine(): Promise<ApiResponse<any[]>> {
    return apiClient.get('/warehouses/me');
  }

  static create(data: {
    countryCode: string;
    name: string;
    code: string;
    type: 'SELLER_WAREHOUSE';
    city?: string;
    addressLine1?: string;
    capacity?: number;
  }): Promise<ApiResponse<any>> {
    return apiClient.post('/warehouses', data);
  }
}
