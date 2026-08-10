import { ApiResponse } from '../api/apiClient';
import {
  AdminApi,
  AdminKycDocument,
  PaginatedAdminKycResponse,
} from '../api/clients/AdminApi';
import { API_CONFIG } from '../config/api';
import { mockAdminKycList } from '../data/mockAdminKyc';

export const KycService = {
  async getPendingKyc(): Promise<
    ApiResponse<PaginatedAdminKycResponse | any[]>
  > {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: mockAdminKycList,
      };
    }

    return AdminApi.getKycDocuments({
      status: 'PENDING',
      page: 1,
      limit: 20,
    });
  },

  async getApprovedKyc(): Promise<
    ApiResponse<PaginatedAdminKycResponse>
  > {
    return AdminApi.getKycDocuments({
      status: 'APPROVED',
      page: 1,
      limit: 20,
    });
  },

  async approveKyc(
    documentId: string,
  ): Promise<ApiResponse<AdminKycDocument>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: {
          id: documentId,
          sellerId: '',
          documentType: '',
          fileKey: '',
          bucket: '',
          fileName: '',
          mimeType: '',
          fileSize: 0,
          status: 'APPROVED',
          isCurrent: true,
          createdAt: '',
          updatedAt: '',
        },
        message: 'Documento KYC aprovado.',
      };
    }

    return AdminApi.approveKycDocument(documentId);
  },

  async rejectKyc(
    documentId: string,
    reason: string,
  ): Promise<ApiResponse<AdminKycDocument>> {
    if (API_CONFIG.USE_FAKE_API) {
      return {
        success: true,
        data: {
          id: documentId,
          sellerId: '',
          documentType: '',
          fileKey: '',
          bucket: '',
          fileName: '',
          mimeType: '',
          fileSize: 0,
          status: 'REJECTED',
          rejectionReason: reason,
          isCurrent: true,
          createdAt: '',
          updatedAt: '',
        },
        message: 'Documento KYC rejeitado.',
      };
    }

    return AdminApi.rejectKycDocument(documentId, reason);
  },

  async approveSeller(
    sellerId: string,
    notes?: string,
  ): Promise<ApiResponse> {
    return AdminApi.approveSellerKyc(sellerId, notes);
  },

  async rejectSeller(
    sellerId: string,
    reason: string,
  ): Promise<ApiResponse> {
    return AdminApi.rejectSellerKyc(sellerId, reason);
  },

  async getDocumentDownloadUrl(
    documentId: string,
  ): Promise<ApiResponse<{ downloadUrl: string; expiresInSeconds: number }>> {
    return AdminApi.getKycDocumentDownloadUrl(documentId);
  },
};