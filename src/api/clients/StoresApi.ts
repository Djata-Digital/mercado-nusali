import { apiClient, ApiResponse } from '../apiClient';
import { PaginatedResponse } from '../types';

export interface StoreCountry {
  id: string;
  code: string;
  name: string;
}

export interface StoreReal {
  id: string;
  sellerId: string;
  countryId: string;

  name: string;
  slug: string;

  description?: string | null;

  logoKey?: string | null;
  logoUrl?: string | null;

  bannerKey?: string | null;
  bannerUrl?: string | null;

  businessEmail?: string | null;
  businessPhone?: string | null;
  website?: string | null;

  addressLine1?: string | null;
  addressLine2?: string | null;

  city?: string | null;
  region?: string | null;
  postalCode?: string | null;

  timezone: string;

  status: string;
  isOfficial: boolean;

  averageRating: string | number;
  totalReviews: number;
  totalFollowers: number;

  createdAt: string;
  updatedAt?: string;

  country?: StoreCountry;

  members?: StoreMemberReal[];
}

export interface PublicStoreSeller {
  status: string;
  tradeName?: string | null;
  averageRating: string | number;
  totalReviews: number;
  totalSales: number;
}

export interface PublicStore extends StoreReal {
  seller?: PublicStoreSeller | null;
}

export type StoreMemberRole =
  | 'OWNER'
  | 'MANAGER'
  | 'CUSTOMER_SERVICE'
  | 'ORDER_OPERATOR'
  | 'INVENTORY_MANAGER'
  | 'FINANCE'
  | 'MARKETING';

export type StoreMemberStatus =
  | 'INVITED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REMOVED';

export interface StoreMemberUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  phoneCode?: string | null;
}

export interface StoreMemberReal {
  id: string;
  storeId: string;
  userId: string;

  role: StoreMemberRole;
  status: StoreMemberStatus;

  invitedById?: string | null;

  joinedAt: string;
  createdAt: string;
  updatedAt: string;

  user?: StoreMemberUser;

  invitedBy?: StoreMemberUser | null;
}

export interface StoreInvitationReal {
  invitationId: string;
  storeId: string;
  email: string;
  role: StoreMemberRole;
  token?: string;
  expiresAt: string;
}

export interface CreateStoreInput {
  name: string;
  slug: string;
  countryCode: string;

  description?: string;
  businessEmail?: string;
  businessPhone?: string;
  website?: string;

  addressLine1?: string;
  city?: string;
  region?: string;
  timezone?: string;
}

export interface UpdateStoreInput {
  name?: string;
  description?: string;

  businessEmail?: string;
  businessPhone?: string;
  website?: string;

  addressLine1?: string;
  city?: string;
  region?: string;
  timezone?: string;
}

export interface UpdateStoreMemberInput {
  role: StoreMemberRole;
  status: StoreMemberStatus;
}

export class StoresApi {
  // ============================================================
  // PUBLIC STORES
  // ============================================================

  static listPublic(params?: {
    page?: number;
    limit?: number;
    search?: string;
    countryId?: string;
  }): Promise<ApiResponse<PaginatedResponse<PublicStore>>> {
    return apiClient.get('/public/stores', {
      params,
    });
  }

  static getPublicBySlug(
    slug: string,
  ): Promise<ApiResponse<PublicStore>> {
    return apiClient.get(
      `/public/stores/${encodeURIComponent(slug)}`,
    );
  }

  // ============================================================
  // SELLER STORES
  // ============================================================

  static listMine(): Promise<
    ApiResponse<StoreReal[]>
  > {
    return apiClient.get('/stores/me');
  }

  static getMineById(
    id: string,
  ): Promise<ApiResponse<StoreReal>> {
    return apiClient.get(`/stores/${id}`);
  }

  static create(
    data: CreateStoreInput,
  ): Promise<ApiResponse<StoreReal>> {
    return apiClient.post('/stores', data);
  }

  static updateMine(
    id: string,
    data: UpdateStoreInput,
  ): Promise<ApiResponse<StoreReal>> {
    return apiClient.patch(
      `/stores/${id}`,
      data,
    );
  }

  static deleteMine(
    id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete(`/stores/${id}`);
  }

  // ============================================================
  // STORE IMAGES
  // ============================================================

  static uploadLogo(
    storeId: string,
    file: File,
  ): Promise<ApiResponse<StoreReal>> {
    const formData = new FormData();

    formData.append('file', file);

    return apiClient.post(
      `/stores/${storeId}/logo`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
  }

  static uploadBanner(
    storeId: string,
    file: File,
  ): Promise<ApiResponse<StoreReal>> {
    const formData = new FormData();

    formData.append('file', file);

    return apiClient.post(
      `/stores/${storeId}/banner`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
  }

  // ============================================================
  // STORE TEAM
  // ============================================================

  static listMembers(
    storeId: string,
  ): Promise<ApiResponse<StoreMemberReal[]>> {
    return apiClient.get(
      `/stores/${storeId}/members`,
    );
  }

  static inviteMember(
    storeId: string,
    data: {
      email: string;
      role: StoreMemberRole;
    },
  ): Promise<ApiResponse<StoreInvitationReal>> {
    return apiClient.post(
      `/stores/${storeId}/members/invite`,
      data,
    );
  }

  static updateMember(
    storeId: string,
    memberId: string,
    data: UpdateStoreMemberInput,
  ): Promise<ApiResponse<StoreMemberReal>> {
    return apiClient.patch(
      `/stores/${storeId}/members/${memberId}`,
      data,
    );
  }

  static removeMember(
    storeId: string,
    memberId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete(
      `/stores/${storeId}/members/${memberId}`,
    );
  }

  // ============================================================
  // STORE INVITATIONS
  // ============================================================

  static acceptInvitation(
    token: string,
  ): Promise<ApiResponse<StoreMemberReal>> {
    return apiClient.post(
      `/store-invitations/${encodeURIComponent(
        token,
      )}/accept`,
      {},
    );
  }

  static rejectInvitation(
    token: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post(
      `/store-invitations/${encodeURIComponent(
        token,
      )}/reject`,
      {},
    );
  }

  // ============================================================
  // ADMIN
  // ============================================================

  static listAdmin(params?: {
    page?: number;
    limit?: number;
    status?: string;
    countryId?: string;
    sellerId?: string;
    search?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/admin/stores',
      {
        params,
      },
    );
  }

  static updateAdminStatus(
    storeId: string,
    data: {
      status: string;
      reason?: string;
    },
  ): Promise<ApiResponse<StoreReal>> {
    return apiClient.patch(
      `/admin/stores/${storeId}/status`,
      data,
    );
  }
}