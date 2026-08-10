import { apiClient, ApiResponse } from '../apiClient';

export interface SellerProfileReal {
  id: string;
  userId: string;
  countryId: string;
  legalName: string;
  tradeName?: string | null;
  description?: string | null;
  status: string;
  averageRating: string | number;
  totalReviews: number;
  totalSales: number;
  createdAt: string;
  updatedAt: string;
  country?: { id: string; code: string; name: string };
  stores?: Array<{ id: string; name: string; slug: string; status: string }>;
  documents?: Array<{
    id: string;
    documentType?: string;
    type?: string;
    status: string;
    createdAt: string;
  }>;
}

export interface SellerDocumentReal {
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
}

export class SellerApi {
  static getMyProfile(): Promise<ApiResponse<SellerProfileReal>> {
    return apiClient.get('/sellers/me');
  }

  static updateMyProfile(data: {
    tradeName?: string;
    description?: string;
    businessEmail?: string;
    businessPhone?: string;
    website?: string;
  }): Promise<ApiResponse<SellerProfileReal>> {
    return apiClient.patch('/sellers/me', data);
  }

  static getMyDocuments(): Promise<ApiResponse<SellerDocumentReal[]>> {
    return apiClient.get('/seller-documents/me');
  }

  static getDocumentById(
    documentId: string,
  ): Promise<ApiResponse<SellerDocumentReal>> {
    return apiClient.get(`/seller-documents/${documentId}`);
  }

  static getDocumentDownloadUrl(
    documentId: string,
  ): Promise<ApiResponse<{ downloadUrl: string; expiresInSeconds: number }>> {
    return apiClient.get(
      `/seller-documents/${documentId}/download-url`,
    );
  }

  static async uploadDocument(
    documentType: string,
    file: File,
  ): Promise<ApiResponse<SellerDocumentReal>> {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post(
      `/seller-documents/upload/${documentType}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
  }

  static deleteDocument(
    documentId: string,
  ): Promise<ApiResponse<SellerDocumentReal>> {
    return apiClient.delete(`/seller-documents/${documentId}`);
  }
}