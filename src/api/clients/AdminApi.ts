import { apiClient, ApiResponse } from '../apiClient';

export class AdminApi {
  static async list(): Promise<ApiResponse<any>> {
    return apiClient.get('/admin/overview');
  }

  static async getById(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/admin/users/${id}`);
  }

  static async create(data: any): Promise<ApiResponse<any>> {
    return apiClient.post('/admin/actions', data);
  }

  static async update(id: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.patch(`/admin/users/${id}`, data);
  }

  static async delete(id: string): Promise<ApiResponse<any>> {
    return apiClient.delete(`/admin/users/${id}`);
  }

  static async search(query: string): Promise<ApiResponse<any>> {
    return apiClient.get('/admin/search', { params: { q: query } });
  }

  static async filters(): Promise<ApiResponse<any>> {
    return apiClient.get('/admin/stats');
  }

  static async pagination(page: number = 1, limit: number = 10): Promise<ApiResponse<any>> {
    return apiClient.get('/admin/users', { params: { page, limit } });
  }
}
