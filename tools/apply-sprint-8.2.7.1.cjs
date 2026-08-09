const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/services/storeService.ts');

if (!fs.existsSync(file)) {
  throw new Error('src/services/storeService.ts não encontrado.');
}

const next = "import { ApiResponse } from '../api/apiClient';\nimport { PublicStore, StoresApi } from '../api/clients/StoresApi';\nimport { CountryCode, Store } from '../types';\n\nconst mapPublicStoreToLegacyStore = (store: PublicStore): Store => ({\n  id: store.id,\n  sellerId: store.sellerId,\n  name: store.name,\n  slug: store.slug,\n  logo: store.logoUrl || '',\n  banner: store.bannerUrl || '',\n  description: store.description || '',\n  address: [store.city, store.region, store.country?.name].filter(Boolean).join(', '),\n  city: store.city || '',\n  country: (store.country?.code || 'GW') as CountryCode,\n  openingHours: '',\n  policies: '',\n  rating: Number(store.averageRating || 0),\n  followersCount: Number(store.totalFollowers || 0),\n  status:\n    store.status === 'ACTIVE'\n      ? 'active'\n      : store.status === 'SUSPENDED'\n        ? 'suspended'\n        : 'pending_approval',\n  team: [],\n  createdAt: store.createdAt,\n});\n\nexport const StoreService = {\n  async getStores(): Promise<ApiResponse<Store[]>> {\n    const res = await StoresApi.listPublic();\n    return {\n      success: res.success,\n      data: (res.data?.items || []).map(mapPublicStoreToLegacyStore),\n      message: res.message,\n    };\n  },\n\n  async getStoreBySlug(slug: string): Promise<ApiResponse<Store | null>> {\n    const res = await StoresApi.getPublicBySlug(slug);\n    return {\n      success: res.success,\n      data: res.data ? mapPublicStoreToLegacyStore(res.data) : null,\n      message: res.message,\n    };\n  },\n};\n";

const current = fs.readFileSync(file, 'utf8');

if (current === next) {
  console.log('OK src/services/storeService.ts (já aplicado)');
} else {
  fs.writeFileSync(file, next, 'utf8');
  console.log('OK src/services/storeService.ts');
}

console.log('Hotfix Sprint 8.2.7.1 aplicado.');
