import {
  apiClient,
  ApiResponse,
} from '../apiClient';

export class WarehouseApi {
  // ============================================================
  // SELLER / OPERATIONAL
  // ============================================================

  static async listMine(): Promise<
    ApiResponse<any[]>
  > {
    return apiClient.get(
      '/warehouses/me',
    );
  }

  static async getById(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.get(
      `/warehouses/${id}`,
    );
  }

  static async create(
    data: any,
  ): Promise<ApiResponse<any>> {
    return apiClient.post(
      '/warehouses',
      data,
    );
  }

  static async update(
    id: string,
    data: any,
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(
      `/warehouses/${id}`,
      data,
    );
  }

  static async delete(
    id: string,
  ): Promise<ApiResponse<any>> {
    return apiClient.delete(
      `/warehouses/${id}`,
    );
  }

  // ============================================================
  // ADMIN
  // ============================================================

  static async listAdmin(params?: {
    page?: number;
    limit?: number;
    status?: string;
    countryId?: string;
    search?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/admin/warehouses',
      {
        params,
      },
    );
  }

  static async updateAdminStatus(
    id: string,
    data: {
      status: string;
      reason?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(
      `/admin/warehouses/${id}/status`,
      data,
    );
  }
}