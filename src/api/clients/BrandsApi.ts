import {
  apiClient,
  ApiResponse,
} from '../apiClient';

export class BrandsApi {
  // ============================================================
  // PUBLIC
  // ============================================================

  static async listPublic(): Promise<
    ApiResponse<any[]>
  > {
    return apiClient.get(
      '/public/brands',
    );
  }

  static async getPublicBySlug(
    slug: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/public/brands/' +
        encodeURIComponent(slug),
    );
  }

  // ============================================================
  // ADMIN
  // ============================================================

  static async listAdmin(): Promise<
    ApiResponse<any[]>
  > {
    return apiClient.get(
      '/admin/brands',
    );
  }

  static async getAdminById(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/admin/brands/${id}`,
    );
  }

  static async create(
    data: any,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      '/admin/brands',
      data,
    );
  }

  static async update(
    id: string,
    data: any,
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(
      `/admin/brands/${id}`,
      data,
    );
  }

  static async delete(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.delete(
      `/admin/brands/${id}`,
    );
  }
}