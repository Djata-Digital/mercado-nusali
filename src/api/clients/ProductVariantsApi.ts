import { apiClient, ApiResponse } from '../apiClient';

export class ProductVariantsApi {
  static create(productId: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/products/${productId}/variants`, data);
  }

  static list(productId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/products/${productId}/variants`);
  }

  static update(id: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.patch(`/product-variants/${id}`, data);
  }

  static delete(id: string): Promise<ApiResponse<any>> {
    return apiClient.delete(`/product-variants/${id}`);
  }
}
