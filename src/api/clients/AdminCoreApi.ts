import { apiClient, ApiResponse } from '../apiClient';

export class AdminProductsApi {
  static list(params?: {
    page?: number;
    limit?: number;
    status?: string;
    storeId?: string;
    categoryId?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.get('/admin/products', { params });
  }

  static approve(id: string): Promise<ApiResponse<any>> {
    return apiClient.patch(`/admin/products/${id}/approve`);
  }

  static reject(id: string, reason: string): Promise<ApiResponse<any>> {
    return apiClient.patch(`/admin/products/${id}/reject`, { reason });
  }
}

export class AdminKycApi {
  static listDocuments(params?: {
    page?: number;
    limit?: number;
    status?: string;
    documentType?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.get('/admin/kyc/documents', { params });
  }

  static approveDocument(id: string): Promise<ApiResponse<any>> {
    return apiClient.patch(`/admin/kyc/documents/${id}/approve`);
  }

  static rejectDocument(id: string, reason: string): Promise<ApiResponse<any>> {
    return apiClient.patch(`/admin/kyc/documents/${id}/reject`, { reason });
  }

  static approveSeller(sellerId: string, notes?: string): Promise<ApiResponse<any>> {
    return apiClient.patch(`/admin/kyc/sellers/${sellerId}/approve`, { notes });
  }

  static rejectSeller(sellerId: string, reason: string): Promise<ApiResponse<any>> {
    return apiClient.patch(`/admin/kyc/sellers/${sellerId}/reject`, { reason });
  }
}

export class AdminSellersApi {
  static list(params?: {
    page?: number;
    limit?: number;
    status?: string;
    countryId?: string;
    search?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.get('/sellers', { params });
  }

  static getById(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/sellers/${id}`);
  }
}

export class AdminAuditApi {
  static list(page = 1, limit = 50): Promise<ApiResponse<any>> {
    return apiClient.get('/audit-logs', { params: { page, limit } });
  }
}
