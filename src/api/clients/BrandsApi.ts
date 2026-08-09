import { apiClient, ApiResponse } from '../apiClient';

export class BrandsApi {
  static async listPublic(): Promise<ApiResponse<any[]>> {
    return apiClient.get('/public/brands');
  }

  static async getPublicBySlug(slug: string): Promise<ApiResponse<any>> {
    return apiClient.get('/public/brands/' + encodeURIComponent(slug));
  }
}
