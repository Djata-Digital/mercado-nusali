import { Category, CountryCode, CurrencyCode, Product, ProductCondition } from '../../types';

const num = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const condition = (value: unknown): ProductCondition => {
  switch (String(value || '').toUpperCase()) {
    case 'USED': return 'usado';
    case 'REFURBISHED': return 'recondicionado';
    default: return 'novo';
  }
};

const iconFor = (slug: string) => {
  const s = slug.toLowerCase();
  if (s.includes('cel') || s.includes('telefon')) return 'Smartphone';
  if (s.includes('tv')) return 'Tv';
  if (s.includes('informat') || s.includes('comput')) return 'Laptop';
  if (s.includes('eletro')) return 'Zap';
  if (s.includes('casa')) return 'Home';
  return 'ShoppingBag';
};

export const mapPublicCategory = (raw: any): Category => ({
  id: String(raw?.id || ''),
  name: String(raw?.name || ''),
  slug: String(raw?.slug || ''),
  iconName: String(raw?.iconName || iconFor(String(raw?.slug || ''))),
  image: String(raw?.imageUrl || raw?.image || ''),
  itemCount: num(raw?.itemCount ?? raw?._count?.products),
  description: raw?.description || undefined,
});

export const mapPublicProduct = (raw: any): Product => {
  const variants = Array.isArray(raw?.variants) ? raw.variants : [];
  const active = variants.find((v: any) => String(v?.status).toUpperCase() === 'ACTIVE') || variants[0] || {};
  const price = num(active?.promotionalPrice ?? active?.price);
  const originalPrice = active?.promotionalPrice != null ? num(active?.price) : undefined;
  const images = Array.isArray(raw?.images) ? raw.images : [];
  const imageUrls = images.map((i: any) => i?.url).filter(Boolean);
  const main = images.find((i: any) => i?.isMain)?.url || imageUrls[0] || '';
  const stock = variants.reduce((sum: number, v: any) => sum + num(v?.stock), 0);
  const store = raw?.store || {};
  const category = raw?.category || {};
  const brand = raw?.brand || {};
  const currency = String(active?.currency?.code || 'XOF') as CurrencyCode;
  const origin = String(raw?.countryOfOrigin?.code || store?.country?.code || 'GW') as CountryCode;

  return {
    id: String(raw?.id || ''),
    slug: String(raw?.slug || ''),
    variantId: active?.id ? String(active.id) : undefined,
    title: String(raw?.title || ''),
    price, currency, originalPrice,
    discountPercentage: originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : undefined,
    installmentsMax: 1, installmentsInterestFree: true,
    image: main, galleryImages: imageUrls,
    category: String(category?.name || ''), categorySlug: String(category?.slug || ''),
    condition: condition(raw?.condition), brand: String(brand?.name || ''), model: '',
    rating: num(raw?.averageRating), reviewsCount: num(raw?.totalReviews),
    seller: {
      id: String(store?.sellerId || store?.id || ''), name: String(store?.name || 'Vendedor'),
      reputationLevel: num(store?.averageRating) >= 4.7 ? 'platinum' : num(store?.averageRating) >= 4 ? 'gold' : 'bom',
      reputationScore: num(store?.averageRating), salesCount: num(raw?.totalSales),
      isOfficialStore: Boolean(store?.isOfficial), kycStatus: 'verified', country: origin,
      location: { city: String(store?.city || ''), state: String(store?.region || '') },
      goodService: true, onTimeDelivery: true,
    },
    storeId: store?.id, storeName: store?.name, isDigitalProduct: String(raw?.productType).toUpperCase() === 'DIGITAL',
    weightKg: raw?.weight == null ? undefined : num(raw.weight),
    dimensionsCm: raw?.length != null && raw?.width != null && raw?.height != null ? { length: num(raw.length), width: num(raw.width), height: num(raw.height) } : undefined,
    shipping: { freeShipping: false, arrivesTomorrow: false, shippingPrice: 0, fullFulfilled: false, isInternational: String(raw?.saleScope).toUpperCase() !== 'NATIONAL', originCountry: origin },
    stock, salesCount: num(raw?.totalSales), description: String(raw?.description || ''), specs: {}, questions: [], reviews: [], createdAt: raw?.createdAt,
  };
};
