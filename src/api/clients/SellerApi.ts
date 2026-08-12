import { apiClient, ApiResponse } from '../apiClient';

export interface SellerProfileReal {
  id: string;
  userId: string;
  countryId: string;

  sellerType: string;
  legalName: string;
  tradeName?: string | null;
  taxId?: string | null;
  registrationNumber?: string | null;

  status: string;
  verificationLevel: number;
  onboardingStatus?: string;

  businessEmail?: string | null;
  businessPhone?: string | null;
  website?: string | null;
  description?: string | null;

  averageRating: string | number;
  totalReviews: number;
  totalSales: number;

  createdAt: string;
  updatedAt: string;

  country?: {
    id: string;
    code: string;
    name: string;
    flag?: string;
    phonePrefix?: string;
  };

  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    phoneCode: string;

    preferredCurrency?: {
      id: string;
      code: string;
      name: string;
      symbol: string;
    } | null;

    addresses?: Array<{
      id: string;
      label?: string | null;
      recipientName: string;
      phone: string;
      phoneCode: string;
      countryId: string;

      country?: {
        id: string;
        code: string;
        name: string;
        phonePrefix?: string;
      };

      region: string;
      city: string;
      district?: string | null;
      neighborhood?: string | null;
      street: string;
      number: string;
      complement?: string | null;
      postalCode?: string | null;

      isDefault: boolean;
      type: string;
    }>;
  };

  stores?: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
  }>;

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
  static createOnboarding(data: {
    sellerType: string;
    legalName: string;
    countryCode: string;
    tradeName?: string;
    taxId?: string;
    registrationNumber?: string;
    businessEmail?: string;
    businessPhone?: string;
    website?: string;
    description?: string;
  }): Promise<ApiResponse<SellerProfileReal>> {
    return apiClient.post('/sellers/onboarding', data);
  }
  static getMyProfile(): Promise<ApiResponse<SellerProfileReal>> {
    return apiClient.get('/sellers/me');
  }

  static updateMyProfile(data: {
    legalName?: string;
    tradeName?: string;
    sellerType?: string;
    taxId?: string;
    businessEmail?: string;
    businessPhone?: string;
    website?: string;
    description?: string;
    countryCode?: string;
    preferredCurrencyCode?: string;
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