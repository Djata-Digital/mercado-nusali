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
  documents?: Array<{ id: string; type: string; status: string; createdAt: string }>;
}

export class SellerApi {
  static getMyProfile(): Promise<ApiResponse<SellerProfileReal>> {
    return apiClient.get('/sellers/me');
  }

  static updateMyProfile(data: {
    tradeName?: string;
    description?: string;
  }): Promise<ApiResponse<SellerProfileReal>> {
    return apiClient.patch('/sellers/me', data);
  }
}
