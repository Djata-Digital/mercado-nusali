import { apiClient, ApiResponse } from '../apiClient';
import { ProductFilters, PaginatedResponse } from '../types';

export class ProductsApi {
  static async listPublic(params?: ProductFilters): Promise<ApiResponse<PaginatedResponse<any>>> { return apiClient.get('/public/products', { params }); }
  static async getPublicBySlug(slug: string): Promise<ApiResponse<any>> { return apiClient.get('/public/products/' + encodeURIComponent(slug)); }
  static async listMine(params?: ProductFilters): Promise<ApiResponse<PaginatedResponse<any>>> { return apiClient.get('/products/me', { params }); }
  static async getById(id: string): Promise<ApiResponse<any>> { return apiClient.get('/products/' + id); }
  static async create(data: any): Promise<ApiResponse<any>> { return apiClient.post('/products', data); }
  static async update(id: string, data: any): Promise<ApiResponse<any>> { return apiClient.patch('/products/' + id, data); }
  static async delete(id: string): Promise<ApiResponse<any>> { return apiClient.delete('/products/' + id); }
  static async submit(id: string): Promise<ApiResponse<any>> {
    return apiClient.post('/products/' + id + '/submit');
  }

  static async pause(id: string): Promise<ApiResponse<any>> {
    return apiClient.patch('/products/' + id + '/pause');
  }

  static async activate(id: string): Promise<ApiResponse<any>> {
    return apiClient.patch('/products/' + id + '/activate');
  }


}
