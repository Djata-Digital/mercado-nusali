import { apiClient, ApiResponse } from '../apiClient';

export class CategoriesApi {
  static async listPublic(): Promise<ApiResponse<any[]>> { return apiClient.get('/public/categories'); }
  static async getPublicBySlug(slug: string): Promise<ApiResponse<any>> { return apiClient.get('/public/categories/' + encodeURIComponent(slug)); }
  static async listAdmin(): Promise<ApiResponse<any[]>> { return apiClient.get('/admin/categories'); }
  static async getAdminById(id: string): Promise<ApiResponse<any>> { return apiClient.get('/admin/categories/' + id); }
  static async create(data: any): Promise<ApiResponse<any>> { return apiClient.post('/admin/categories', data); }
  static async update(id: string, data: any): Promise<ApiResponse<any>> { return apiClient.patch('/admin/categories/' + id, data); }
  static async delete(id: string): Promise<ApiResponse<any>> { return apiClient.delete('/admin/categories/' + id); }
}
