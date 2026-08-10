import { apiClient, ApiResponse } from '../apiClient';

export type SellerDocumentType =
  | 'IDENTITY_DOCUMENT'
  | 'PASSPORT'
  | 'ADDRESS_PROOF'
  | 'SELFIE';

export type SellerDocumentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export interface SellerDocument {
  id: string;
  sellerId: string;
  documentType: SellerDocumentType | string;
  fileKey: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: SellerDocumentStatus | string;
  rejectionReason?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  expiresAt?: string | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface SellerDocumentDownloadUrl {
  downloadUrl: string;
  expiresInSeconds: number;
}

export class SellerDocumentsApi {
  /**
   * Lista os documentos KYC do vendedor autenticado.
   */
  static async getMyDocuments(): Promise<ApiResponse<SellerDocument[]>> {
    return apiClient.get('/seller-documents/me');
  }

  /**
   * Obtém os detalhes de um documento pertencente ao vendedor.
   */
  static async getById(
    documentId: string,
  ): Promise<ApiResponse<SellerDocument>> {
    return apiClient.get(`/seller-documents/${documentId}`);
  }

  /**
   * Envia um documento KYC.
   *
   * O backend espera multipart/form-data com o campo "file".
   */
  static async upload(
    documentType: SellerDocumentType,
    file: File,
  ): Promise<ApiResponse<SellerDocument>> {
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

  /**
   * Solicita uma URL temporária e assinada para visualizar/download
   * do documento privado.
   */
  static async getDownloadUrl(
    documentId: string,
  ): Promise<ApiResponse<SellerDocumentDownloadUrl>> {
    return apiClient.get(
      `/seller-documents/${documentId}/download-url`,
    );
  }

  /**
   * Remove um documento KYC.
   *
   * O backend decide se o documento pode ser removido,
   * por exemplo, de acordo com o status atual.
   */
  static async delete(
    documentId: string,
  ): Promise<ApiResponse> {
    return apiClient.delete(
      `/seller-documents/${documentId}`,
    );
  }
}