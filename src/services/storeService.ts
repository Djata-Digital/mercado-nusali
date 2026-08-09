import { ApiResponse } from '../api/apiClient';
import { PublicStore, StoresApi } from '../api/clients/StoresApi';
import { CountryCode, Store } from '../types';

const mapPublicStoreToLegacyStore = (store: PublicStore): Store => ({
  id: store.id,
  sellerId: store.sellerId,
  name: store.name,
  slug: store.slug,
  logo: store.logoUrl || '',
  banner: store.bannerUrl || '',
  description: store.description || '',
  address: [store.city, store.region, store.country?.name].filter(Boolean).join(', '),
  city: store.city || '',
  country: (store.country?.code || 'GW') as CountryCode,
  openingHours: '',
  policies: '',
  rating: Number(store.averageRating || 0),
  followersCount: Number(store.totalFollowers || 0),
  status:
    store.status === 'ACTIVE'
      ? 'active'
      : store.status === 'SUSPENDED'
        ? 'suspended'
        : 'pending_approval',
  team: [],
  createdAt: store.createdAt,
});

export const StoreService = {
  async getStores(): Promise<ApiResponse<Store[]>> {
    const res = await StoresApi.listPublic();
    return {
      success: res.success,
      data: (res.data?.items || []).map(mapPublicStoreToLegacyStore),
      message: res.message,
    };
  },

  async getStoreBySlug(slug: string): Promise<ApiResponse<Store | null>> {
    const res = await StoresApi.getPublicBySlug(slug);
    return {
      success: res.success,
      data: res.data ? mapPublicStoreToLegacyStore(res.data) : null,
      message: res.message,
    };
  },
};
