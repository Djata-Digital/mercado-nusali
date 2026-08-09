import { apiClient, ApiResponse } from '../apiClient';
import { PaginatedResponse } from '../types';

export interface PublicStoreSeller {
  status: string;
  tradeName?: string | null;
  averageRating: string | number;
  totalReviews: number;
  totalSales: number;
}

export interface PublicStoreCountry {
  id: string;
  code: string;
  name: string;
}

export interface PublicStore {
  id: string;
  sellerId: string;
  countryId: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  city?: string | null;
  region?: string | null;
  timezone: string;
  status: string;
  isOfficial: boolean;
  averageRating: string | number;
  totalReviews: number;
  totalFollowers: number;
  createdAt: string;
  country: PublicStoreCountry;
  seller?: PublicStoreSeller | null;
}

export class StoresApi {
  static listPublic(params?: {
    page?: number;
    limit?: number;
    search?: string;
    countryId?: string;
  }): Promise<ApiResponse<PaginatedResponse<PublicStore>>> {
    return apiClient.get('/public/stores', { params });
  }

  static getPublicBySlug(slug: string): Promise<ApiResponse<PublicStore>> {
    return apiClient.get(`/public/stores/${encodeURIComponent(slug)}`);
  }
  static listMine(): Promise<ApiResponse<any[]>> {
    return apiClient.get('/stores/me');
  }

  static getMineById(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/stores/${id}`);
  }

  static updateMine(id: string, data: any): Promise<ApiResponse<any>> {
    return apiClient.patch(`/stores/${id}`, data);
  }


}
