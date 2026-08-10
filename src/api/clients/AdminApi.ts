import { apiClient, ApiResponse } from '../apiClient';

export interface AdminKycDocument {
  id: string;
  sellerId: string;
  documentType: string;
  fileKey: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  rejectionReason?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  seller?: {
    id: string;
    userId: string;
    sellerType: string;
    legalName: string;
    tradeName?: string | null;
    taxId?: string | null;
    registrationNumber?: string | null;
    status: string;
    verificationLevel: number;
    onboardingStatus: string;
    countryId: string;
    businessEmail?: string | null;
    businessPhone?: string | null;
    website?: string | null;
    description?: string | null;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      phoneCode: string;
      status: string;
      isEmailVerified: boolean;
      isPhoneVerified: boolean;
      countryId?: string | null;
    };
  };
}

export interface PaginatedAdminKycResponse {
  items: AdminKycDocument[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class AdminApi {
  static async list(): Promise<ApiResponse> {
    return apiClient.get('/admin/overview');
  }

  static async getById(id: string): Promise<ApiResponse> {
    return apiClient.get(`/admin/users/${id}`);
  }

  static async create(data: any): Promise<ApiResponse> {
    return apiClient.post('/admin/actions', data);
  }

  static async update(id: string, data: any): Promise<ApiResponse> {
    return apiClient.patch(`/admin/users/${id}`, data);
  }

  static async delete(id: string): Promise<ApiResponse> {
    return apiClient.delete(`/admin/users/${id}`);
  }

  static async search(query: string): Promise<ApiResponse> {
    return apiClient.get('/admin/search', {
      params: { q: query },
    });
  }

  static async filters(): Promise<ApiResponse> {
    return apiClient.get('/admin/stats');
  }

  static async pagination(
    page: number = 1,
    limit: number = 10,
  ): Promise<ApiResponse> {
    return apiClient.get('/admin/users', {
      params: { page, limit },
    });
  }

  static async getKycDocuments(params?: {
    status?: string;
    documentType?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<PaginatedAdminKycResponse>> {
    return apiClient.get('/admin/kyc/documents', {
      params,
    });
  }

  static async approveKycDocument(
    documentId: string,
  ): Promise<ApiResponse<AdminKycDocument>> {
    return apiClient.patch(
      `/admin/kyc/documents/${documentId}/approve`,
    );
  }

  static async rejectKycDocument(
    documentId: string,
    reason: string,
  ): Promise<ApiResponse<AdminKycDocument>> {
    return apiClient.patch(
      `/admin/kyc/documents/${documentId}/reject`,
      { reason },
    );
  }

  static async approveSellerKyc(
    sellerId: string,
    notes?: string,
  ): Promise<ApiResponse> {
    return apiClient.patch(
      `/admin/kyc/sellers/${sellerId}/approve`,
      { notes },
    );
  }

  static async rejectSellerKyc(
    sellerId: string,
    reason: string,
  ): Promise<ApiResponse> {
    return apiClient.patch(
      `/admin/kyc/sellers/${sellerId}/reject`,
      { reason },
    );
  }

  static async getKycDocumentDownloadUrl(
    documentId: string,
  ): Promise<ApiResponse<{ downloadUrl: string; expiresInSeconds: number }>> {
    return apiClient.get(
      `/seller-documents/${documentId}/download-url`,
    );
  }
}