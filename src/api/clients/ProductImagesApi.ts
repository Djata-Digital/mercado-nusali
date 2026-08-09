import { apiClient, ApiResponse } from '../apiClient';

export class ProductImagesApi {
  static upload(productId: string, file: File): Promise<ApiResponse<any>> {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post(`/products/${productId}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  static list(productId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/products/${productId}/images`);
  }

  static setMain(productId: string, imageId: string): Promise<ApiResponse<any>> {
    return apiClient.patch(`/products/${productId}/images/${imageId}/main`);
  }

  static delete(productId: string, imageId: string): Promise<ApiResponse<any>> {
    return apiClient.delete(`/products/${productId}/images/${imageId}`);
  }
}
