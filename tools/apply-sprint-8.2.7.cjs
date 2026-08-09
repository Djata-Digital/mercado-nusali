const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function write(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  console.log('OK', rel);
}

function replaceRequired(rel, before, after) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(after)) {
    console.log('OK', rel, '(já aplicado)');
    return;
  }
  if (!s.includes(before)) throw new Error(`Trecho esperado não encontrado em ${rel}`);
  s = s.replace(before, after);
  fs.writeFileSync(file, s, 'utf8');
  console.log('OK', rel);
}

console.log('=== Sprint 8.2.7 — Public Stores Real ===');

write('src/api/clients/StoresApi.ts', "import { apiClient, ApiResponse } from '../apiClient';\nimport { PaginatedResponse } from '../types';\n\nexport interface PublicStoreSeller {\n  status: string;\n  tradeName?: string | null;\n  averageRating: string | number;\n  totalReviews: number;\n  totalSales: number;\n}\n\nexport interface PublicStoreCountry {\n  id: string;\n  code: string;\n  name: string;\n}\n\nexport interface PublicStore {\n  id: string;\n  sellerId: string;\n  countryId: string;\n  name: string;\n  slug: string;\n  description?: string | null;\n  logoUrl?: string | null;\n  bannerUrl?: string | null;\n  city?: string | null;\n  region?: string | null;\n  timezone: string;\n  status: string;\n  isOfficial: boolean;\n  averageRating: string | number;\n  totalReviews: number;\n  totalFollowers: number;\n  createdAt: string;\n  country: PublicStoreCountry;\n  seller?: PublicStoreSeller | null;\n}\n\nexport class StoresApi {\n  static listPublic(params?: {\n    page?: number;\n    limit?: number;\n    search?: string;\n    countryId?: string;\n  }): Promise<ApiResponse<PaginatedResponse<PublicStore>>> {\n    return apiClient.get('/public/stores', { params });\n  }\n\n  static getPublicBySlug(slug: string): Promise<ApiResponse<PublicStore>> {\n    return apiClient.get(`/public/stores/${encodeURIComponent(slug)}`);\n  }\n}\n");
write('src/pages/StoresListPage.tsx', "import React, { useState } from 'react';\nimport { useNavigate } from 'react-router-dom';\nimport { useQuery } from '@tanstack/react-query';\nimport { Building2, Loader2, MapPin, Search, ShieldCheck, Star } from 'lucide-react';\nimport { StoresApi } from '../api/clients/StoresApi';\n\nconst rating = (value: string | number) => {\n  const parsed = Number(value || 0);\n  return Number.isFinite(parsed) ? parsed : 0;\n};\n\nexport const StoresListPage: React.FC = () => {\n  const navigate = useNavigate();\n  const [search, setSearch] = useState('');\n\n  const storesQuery = useQuery({\n    queryKey: ['public-stores', search],\n    queryFn: async () => {\n      const response = await StoresApi.listPublic({\n        page: 1,\n        limit: 50,\n        ...(search.trim() ? { search: search.trim() } : {}),\n      });\n      return response.data;\n    },\n  });\n\n  const stores = storesQuery.data?.items || [];\n\n  return (\n    <div className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8\">\n      <div className=\"flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8\">\n        <div>\n          <h1 className=\"text-2xl font-black text-gray-900\">Lojas do Mercado Nusali</h1>\n          <p className=\"text-sm text-gray-500 mt-1\">\n            Apenas lojas ativas retornadas pelo catálogo público do marketplace.\n          </p>\n        </div>\n\n        <div className=\"relative w-full md:w-80\">\n          <Search className=\"w-4 h-4 text-gray-400 absolute left-3 top-3\" />\n          <input\n            value={search}\n            onChange={(e) => setSearch(e.target.value)}\n            placeholder=\"Buscar loja...\"\n            className=\"w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-emerald-600\"\n          />\n        </div>\n      </div>\n\n      {storesQuery.isLoading ? (\n        <div className=\"py-20 flex justify-center text-emerald-700\">\n          <Loader2 className=\"w-7 h-7 animate-spin\" />\n        </div>\n      ) : storesQuery.isError ? (\n        <div className=\"bg-white border border-red-200 rounded-2xl p-10 text-center\">\n          <Building2 className=\"w-12 h-12 text-red-300 mx-auto mb-3\" />\n          <h2 className=\"font-bold text-gray-900\">Não foi possível carregar as lojas.</h2>\n          <p className=\"text-xs text-gray-500 mt-1\">Verifique a API e tente novamente.</p>\n        </div>\n      ) : stores.length === 0 ? (\n        <div className=\"bg-white border border-gray-200 rounded-2xl p-10 text-center\">\n          <Building2 className=\"w-12 h-12 text-gray-300 mx-auto mb-3\" />\n          <h2 className=\"font-bold text-gray-900\">Nenhuma loja encontrada.</h2>\n        </div>\n      ) : (\n        <div className=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6\">\n          {stores.map((store) => (\n            <button\n              key={store.id}\n              onClick={() => navigate(`/stores/${store.slug}`)}\n              className=\"bg-white border border-gray-200 rounded-2xl overflow-hidden text-left hover:shadow-lg transition group\"\n            >\n              <div className=\"h-28 bg-gradient-to-r from-blue-950 via-emerald-900 to-teal-900 relative overflow-hidden\">\n                {store.bannerUrl && (\n                  <img\n                    src={store.bannerUrl}\n                    alt=\"\"\n                    className=\"w-full h-full object-cover opacity-55\"\n                    referrerPolicy=\"no-referrer\"\n                  />\n                )}\n              </div>\n\n              <div className=\"p-5\">\n                <div className=\"flex gap-3 -mt-10 mb-4 relative z-10\">\n                  <div className=\"w-16 h-16 rounded-xl bg-emerald-600 border-4 border-white shadow-md overflow-hidden flex items-center justify-center text-white\">\n                    {store.logoUrl ? (\n                      <img\n                        src={store.logoUrl}\n                        alt={store.name}\n                        className=\"w-full h-full object-cover\"\n                        referrerPolicy=\"no-referrer\"\n                      />\n                    ) : (\n                      <Building2 className=\"w-8 h-8\" />\n                    )}\n                  </div>\n                </div>\n\n                <div className=\"flex items-start justify-between gap-3\">\n                  <div className=\"min-w-0\">\n                    <h2 className=\"font-black text-gray-900 truncate group-hover:text-emerald-700\">\n                      {store.name}\n                    </h2>\n                    <p className=\"text-xs text-gray-500 mt-1 line-clamp-2\">\n                      {store.description || 'Sem descrição pública cadastrada.'}\n                    </p>\n                  </div>\n\n                  {(store.isOfficial || store.seller?.status === 'VERIFIED') && (\n                    <ShieldCheck className=\"w-5 h-5 text-emerald-600 shrink-0\" />\n                  )}\n                </div>\n\n                <div className=\"mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-gray-600\">\n                  <span className=\"flex items-center gap-1\">\n                    <MapPin className=\"w-3.5 h-3.5 text-emerald-700\" />\n                    {[store.city, store.region, store.country?.name].filter(Boolean).join(', ') || store.country?.code}\n                  </span>\n                  <span className=\"flex items-center gap-1\">\n                    <Star className=\"w-3.5 h-3.5 text-amber-500\" />\n                    {rating(store.averageRating).toFixed(1)} ({store.totalReviews || 0})\n                  </span>\n                </div>\n              </div>\n            </button>\n          ))}\n        </div>\n      )}\n    </div>\n  );\n};\n");
write('src/components/StorePublicView.tsx', "import React, { useState } from 'react';\nimport { useNavigate, useParams } from 'react-router-dom';\nimport { useQuery } from '@tanstack/react-query';\nimport {\n  Building2,\n  Loader2,\n  MapPin,\n  Package,\n  Search,\n  Share2,\n  ShieldCheck,\n  Star,\n} from 'lucide-react';\nimport { ProductCard } from './ProductCard';\nimport { StoresApi } from '../api/clients/StoresApi';\nimport { ProductsApi } from '../api/clients/ProductsApi';\nimport { mapPublicProduct } from '../api/adapters/publicCatalog';\n\nconst numberValue = (value: unknown) => {\n  const parsed = Number(value || 0);\n  return Number.isFinite(parsed) ? parsed : 0;\n};\n\nexport const StorePublicView: React.FC = () => {\n  const { slug = '' } = useParams<{ slug: string }>();\n  const navigate = useNavigate();\n  const [activeTab, setActiveTab] = useState<'catalog' | 'about' | 'reviews'>('catalog');\n  const [searchFilter, setSearchFilter] = useState('');\n\n  const storeQuery = useQuery({\n    queryKey: ['public-store', slug],\n    queryFn: async () => {\n      const response = await StoresApi.getPublicBySlug(slug);\n      return response.data;\n    },\n    enabled: Boolean(slug),\n  });\n\n  const store = storeQuery.data;\n\n  const productsQuery = useQuery({\n    queryKey: ['public-store-products', store?.id],\n    queryFn: async () => {\n      const response = await ProductsApi.listPublic({\n        storeId: store!.id,\n        page: 1,\n        limit: 100,\n      });\n      const raw: any = response.data;\n      const items = Array.isArray(raw?.items) ? raw.items : [];\n      return {\n        items: items.map(mapPublicProduct),\n        total: Number(raw?.total || items.length),\n      };\n    },\n    enabled: Boolean(store?.id),\n  });\n\n  if (storeQuery.isLoading) {\n    return (\n      <div className=\"py-20 flex justify-center text-emerald-700\">\n        <Loader2 className=\"w-7 h-7 animate-spin\" />\n      </div>\n    );\n  }\n\n  if (storeQuery.isError || !store) {\n    return (\n      <div className=\"max-w-4xl mx-auto px-4 py-16 text-center\">\n        <Building2 className=\"w-16 h-16 text-gray-300 mx-auto mb-4\" />\n        <h2 className=\"text-xl font-bold text-gray-900\">Loja não encontrada ou inativa.</h2>\n        <button\n          onClick={() => navigate('/stores')}\n          className=\"mt-5 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold\"\n        >\n          Ver lojas\n        </button>\n      </div>\n    );\n  }\n\n  const products = productsQuery.data?.items || [];\n  const filteredStoreProducts = products.filter(\n    (product) =>\n      product.title.toLowerCase().includes(searchFilter.toLowerCase()) ||\n      product.category.toLowerCase().includes(searchFilter.toLowerCase()),\n  );\n\n  const storeRating = numberValue(store.averageRating);\n  const sellerRating = numberValue(store.seller?.averageRating);\n\n  const handleShare = async () => {\n    try {\n      await navigator.clipboard.writeText(window.location.href);\n    } catch {\n      // Clipboard pode ser bloqueado pelo navegador; não há fallback comercial fictício.\n    }\n  };\n\n  return (\n    <div className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn\">\n      <div className=\"relative h-48 sm:h-64 rounded-2xl overflow-hidden bg-gradient-to-r from-blue-950 via-emerald-900 to-teal-900 border border-gray-200 shadow-md mb-6\">\n        {store.bannerUrl && (\n          <img\n            src={store.bannerUrl}\n            alt={store.name}\n            className=\"w-full h-full object-cover opacity-45\"\n            referrerPolicy=\"no-referrer\"\n          />\n        )}\n        <div className=\"absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent\" />\n        <div className=\"absolute top-4 right-4\">\n          <button\n            onClick={() => void handleShare()}\n            className=\"bg-white/90 hover:bg-white text-gray-900 p-2 rounded-full shadow-md\"\n            title=\"Copiar link da loja\"\n          >\n            <Share2 className=\"w-4 h-4\" />\n          </button>\n        </div>\n      </div>\n\n      <div className=\"bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-8 -mt-16 relative z-10 mx-2 sm:mx-6\">\n        <div className=\"flex flex-col md:flex-row items-start md:items-center justify-between gap-6\">\n          <div className=\"flex items-center gap-4\">\n            <div className=\"w-20 h-20 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg border-4 border-white overflow-hidden shrink-0\">\n              {store.logoUrl ? (\n                <img\n                  src={store.logoUrl}\n                  alt={store.name}\n                  className=\"w-full h-full object-cover\"\n                  referrerPolicy=\"no-referrer\"\n                />\n              ) : (\n                <Building2 className=\"w-10 h-10\" />\n              )}\n            </div>\n\n            <div>\n              <div className=\"flex items-center gap-2 flex-wrap\">\n                <h1 className=\"text-2xl font-black text-gray-900\">{store.name}</h1>\n                {store.seller?.status === 'VERIFIED' && (\n                  <span className=\"bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300\">\n                    <ShieldCheck className=\"w-3 h-3\" /> VENDEDOR VERIFICADO\n                  </span>\n                )}\n                {store.isOfficial && (\n                  <span className=\"bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-200\">\n                    LOJA OFICIAL\n                  </span>\n                )}\n              </div>\n\n              <p className=\"text-xs text-gray-600 mt-1 max-w-xl\">\n                {store.description || 'Sem descrição pública cadastrada.'}\n              </p>\n\n              <div className=\"flex items-center gap-4 mt-3 text-xs text-gray-600 flex-wrap\">\n                <span className=\"flex items-center gap-1 font-semibold text-gray-900\">\n                  <Star className=\"w-4 h-4 text-amber-500\" />\n                  {storeRating.toFixed(1)} / 5.0 ({store.totalReviews || 0} avaliações)\n                </span>\n                <span className=\"flex items-center gap-1\">\n                  <MapPin className=\"w-4 h-4 text-emerald-700\" />\n                  {[store.city, store.region, store.country?.name].filter(Boolean).join(', ') || store.country?.code}\n                </span>\n              </div>\n            </div>\n          </div>\n\n          <div className=\"text-xs text-gray-500\">\n            {store.seller?.totalSales != null && (\n              <span>\n                Vendas registradas do vendedor: <strong className=\"text-gray-900\">{store.seller.totalSales}</strong>\n              </span>\n            )}\n          </div>\n        </div>\n      </div>\n\n      <div className=\"border-b border-gray-200 mb-6 flex items-center gap-8 text-sm font-bold overflow-x-auto\">\n        <button\n          onClick={() => setActiveTab('catalog')}\n          className={`pb-3 border-b-2 whitespace-nowrap ${\n            activeTab === 'catalog'\n              ? 'border-emerald-600 text-emerald-700'\n              : 'border-transparent text-gray-500'\n          }`}\n        >\n          <Package className=\"w-4 h-4 inline mr-2\" />\n          Catálogo ({productsQuery.data?.total ?? products.length})\n        </button>\n        <button\n          onClick={() => setActiveTab('about')}\n          className={`pb-3 border-b-2 whitespace-nowrap ${\n            activeTab === 'about'\n              ? 'border-emerald-600 text-emerald-700'\n              : 'border-transparent text-gray-500'\n          }`}\n        >\n          <Building2 className=\"w-4 h-4 inline mr-2\" /> Sobre\n        </button>\n        <button\n          onClick={() => setActiveTab('reviews')}\n          className={`pb-3 border-b-2 whitespace-nowrap ${\n            activeTab === 'reviews'\n              ? 'border-emerald-600 text-emerald-700'\n              : 'border-transparent text-gray-500'\n          }`}\n        >\n          <Star className=\"w-4 h-4 inline mr-2\" /> Reputação\n        </button>\n      </div>\n\n      {activeTab === 'catalog' && (\n        <div>\n          <div className=\"bg-white p-4 rounded-xl border border-gray-200 mb-6 flex items-center justify-between gap-4\">\n            <div className=\"relative flex-1 max-w-md\">\n              <input\n                type=\"text\"\n                value={searchFilter}\n                onChange={(e) => setSearchFilter(e.target.value)}\n                placeholder={`Buscar dentro de ${store.name}...`}\n                className=\"w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600\"\n              />\n              <Search className=\"w-4 h-4 text-gray-400 absolute left-3 top-2.5\" />\n            </div>\n          </div>\n\n          {productsQuery.isLoading ? (\n            <div className=\"py-14 flex justify-center text-emerald-700\">\n              <Loader2 className=\"w-6 h-6 animate-spin\" />\n            </div>\n          ) : productsQuery.isError ? (\n            <div className=\"bg-white border border-red-200 rounded-2xl p-10 text-center text-sm text-gray-600\">\n              Não foi possível carregar o catálogo desta loja.\n            </div>\n          ) : filteredStoreProducts.length ? (\n            <div className=\"grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6\">\n              {filteredStoreProducts.map((product) => (\n                <ProductCard key={product.id} product={product} />\n              ))}\n            </div>\n          ) : (\n            <div className=\"bg-white rounded-2xl border border-gray-200 p-12 text-center\">\n              <Package className=\"w-12 h-12 text-gray-300 mx-auto mb-3\" />\n              <h3 className=\"font-bold text-gray-800\">Nenhum produto encontrado nesta loja.</h3>\n            </div>\n          )}\n        </div>\n      )}\n\n      {activeTab === 'about' && (\n        <div className=\"bg-white rounded-2xl border border-gray-200 p-8 space-y-5\">\n          <h3 className=\"text-xl font-bold text-gray-900\">Informações públicas</h3>\n          <p className=\"text-sm text-gray-600 leading-relaxed\">\n            {store.description || 'Esta loja ainda não cadastrou uma descrição pública.'}\n          </p>\n\n          <div className=\"grid sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100 text-xs\">\n            <div className=\"p-4 bg-emerald-50 rounded-xl border border-emerald-100\">\n              <div className=\"font-black text-gray-900\">Status da loja</div>\n              <div className=\"text-emerald-800 mt-1\">{store.status}</div>\n            </div>\n            <div className=\"p-4 bg-blue-50 rounded-xl border border-blue-100\">\n              <div className=\"font-black text-gray-900\">País</div>\n              <div className=\"text-blue-800 mt-1\">{store.country?.name || store.country?.code}</div>\n            </div>\n            <div className=\"p-4 bg-purple-50 rounded-xl border border-purple-100\">\n              <div className=\"font-black text-gray-900\">Vendedor</div>\n              <div className=\"text-purple-800 mt-1\">{store.seller?.status || 'Não informado'}</div>\n            </div>\n          </div>\n        </div>\n      )}\n\n      {activeTab === 'reviews' && (\n        <div className=\"bg-white rounded-2xl border border-gray-200 p-8\">\n          <div className=\"grid sm:grid-cols-2 gap-6\">\n            <div>\n              <div className=\"text-xs text-gray-500\">Avaliação da loja</div>\n              <div className=\"text-4xl font-black text-gray-900 mt-1\">{storeRating.toFixed(1)}</div>\n              <div className=\"text-xs text-gray-500 mt-1\">{store.totalReviews || 0} avaliações registradas</div>\n            </div>\n            <div>\n              <div className=\"text-xs text-gray-500\">Avaliação do vendedor</div>\n              <div className=\"text-4xl font-black text-gray-900 mt-1\">{sellerRating.toFixed(1)}</div>\n              <div className=\"text-xs text-gray-500 mt-1\">{store.seller?.totalReviews || 0} avaliações registradas</div>\n            </div>\n          </div>\n\n          <div className=\"mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600\">\n            O backend público atual fornece os agregados reais de reputação, mas ainda não expõe uma\n            lista pública de comentários individuais da loja. Nenhum depoimento fictício é exibido.\n          </div>\n        </div>\n      )}\n    </div>\n  );\n};\n");

replaceRequired(
  'src/api/types.ts',
  `  sellerId?: string;\n  search?: string;`,
  `  sellerId?: string;\n  storeId?: string;\n  search?: string;`
);

replaceRequired(
  'src/App.tsx',
  `<Route path="/stores/:id" element={<StorePublicPage />} />`,
  `<Route path="/stores/:slug" element={<StorePublicPage />} />`
);

replaceRequired(
  'apps/api/src/modules/products/products.service.ts',
  `    if (query.brandId) where.brandId = query.brandId;\n    if (query.search) {`,
  `    if (query.brandId) where.brandId = query.brandId;\n    if (query.storeId) where.storeId = query.storeId;\n    if (query.search) {`
);

const storesServicePath = path.join(ROOT, 'apps/api/src/modules/stores/stores.service.ts');
let storesService = fs.readFileSync(storesServicePath, 'utf8');

const oldMap = `  private mapStorePublicUrls(store: any) {
    if (!store) return store;
    const logoUrl = store.logoKey ? this.minioService.getPublicUrl(store.logoKey) : null;
    const bannerUrl = store.bannerKey ? this.minioService.getPublicUrl(store.bannerKey) : null;

    return {
      ...store,
      logoUrl,
      bannerUrl,
    };
  }`;

const newMap = `  private mapStorePublicUrls(store: any) {
    if (!store) return store;
    const canBuildPublicUrl = typeof (this.minioService as any)?.getPublicUrl === 'function';
    const logoUrl = store.logoKey && canBuildPublicUrl
      ? this.minioService.getPublicUrl(store.logoKey)
      : (store.logoUrl || null);
    const bannerUrl = store.bannerKey && canBuildPublicUrl
      ? this.minioService.getPublicUrl(store.bannerKey)
      : (store.bannerUrl || null);

    return {
      ...store,
      logoUrl,
      bannerUrl,
    };
  }

  private mapPublicStore(store: any) {
    const mapped = this.mapStorePublicUrls(store);
    return {
      id: mapped.id,
      sellerId: mapped.sellerId,
      countryId: mapped.countryId,
      name: mapped.name,
      slug: mapped.slug,
      description: mapped.description,
      logoUrl: mapped.logoUrl,
      bannerUrl: mapped.bannerUrl,
      city: mapped.city,
      region: mapped.region,
      timezone: mapped.timezone,
      status: mapped.status,
      isOfficial: mapped.isOfficial,
      averageRating: mapped.averageRating,
      totalReviews: mapped.totalReviews,
      totalFollowers: mapped.totalFollowers,
      createdAt: mapped.createdAt,
      country: mapped.country
        ? { id: mapped.country.id, code: mapped.country.code, name: mapped.country.name }
        : null,
      seller: mapped.seller
        ? {
            status: mapped.seller.status,
            tradeName: mapped.seller.tradeName,
            averageRating: mapped.seller.averageRating,
            totalReviews: mapped.seller.totalReviews,
            totalSales: mapped.seller.totalSales,
          }
        : null,
    };
  }`;

if (storesService.includes(oldMap)) {
  storesService = storesService.replace(oldMap, newMap);
  console.log('OK stores.service.ts mapper público sanitizado');
} else if (storesService.includes('private mapPublicStore(store: any)')) {
  console.log('OK stores.service.ts mapper público sanitizado (já aplicado)');
} else {
  throw new Error('Mapper esperado de StoresService não encontrado.');
}

const publicStart = storesService.indexOf('// Public Endpoints');
const publicEnd = storesService.indexOf('// Admin Endpoints', publicStart);
if (publicStart < 0 || publicEnd < 0) {
  throw new Error('Bloco Public Endpoints de StoresService não encontrado.');
}

let publicBlock = storesService.slice(publicStart, publicEnd);

const oldListInclude = `        include: { country: true },`;
const newListInclude = `        include: {
          country: true,
          seller: {
            select: {
              status: true,
              tradeName: true,
              averageRating: true,
              totalReviews: true,
              totalSales: true,
            },
          },
        },`;

if (publicBlock.includes(oldListInclude)) {
  publicBlock = publicBlock.replace(oldListInclude, newListInclude);
  console.log('OK stores.service.ts listagem inclui apenas seller público');
} else if (publicBlock.includes('tradeName: true') && publicBlock.includes('totalSales: true')) {
  console.log('OK stores.service.ts listagem seller público (já aplicado)');
} else {
  throw new Error('Include público da listagem de lojas não encontrado.');
}

const oldMappedItems = `    const mappedItems = items.map((s) => this.mapStorePublicUrls(s));`;
const newMappedItems = `    const mappedItems = items.map((s) => this.mapPublicStore(s));`;
if (publicBlock.includes(oldMappedItems)) {
  publicBlock = publicBlock.replace(oldMappedItems, newMappedItems);
  console.log('OK stores.service.ts listagem sanitizada');
} else if (publicBlock.includes(newMappedItems)) {
  console.log('OK stores.service.ts listagem sanitizada (já aplicado)');
} else {
  throw new Error('Mapeamento público de listagem não encontrado.');
}

const oldDetailInclude = `      include: { country: true, seller: true },`;
const newDetailInclude = `      include: {
        country: true,
        seller: {
          select: {
            status: true,
            tradeName: true,
            averageRating: true,
            totalReviews: true,
            totalSales: true,
          },
        },
      },`;

if (publicBlock.includes(oldDetailInclude)) {
  publicBlock = publicBlock.replace(oldDetailInclude, newDetailInclude);
  console.log('OK stores.service.ts detalhe não expõe SellerProfile inteiro');
} else if (publicBlock.includes(newDetailInclude)) {
  console.log('OK stores.service.ts detalhe seller sanitizado (já aplicado)');
} else {
  throw new Error('Include público do detalhe de loja não encontrado.');
}

storesService =
  storesService.slice(0, publicStart) +
  publicBlock +
  storesService.slice(publicEnd);

const oldDetailMap = `    const mapped = this.mapStorePublicUrls(store);\n    await this.redisService.set(cacheKey, JSON.stringify(mapped), 600);`;
const newDetailMap = `    const mapped = this.mapPublicStore(store);\n    await this.redisService.set(cacheKey, JSON.stringify(mapped), 600);`;
if (storesService.includes(oldDetailMap)) {
  storesService = storesService.replace(oldDetailMap, newDetailMap);
  console.log('OK stores.service.ts detalhe sanitizado');
} else if (storesService.includes(newDetailMap)) {
  console.log('OK stores.service.ts detalhe sanitizado (já aplicado)');
} else {
  throw new Error('Mapeamento público do detalhe não encontrado.');
}

fs.writeFileSync(storesServicePath, storesService, 'utf8');

console.log('Sprint 8.2.7 aplicada. Execute checker, lint, builds e testes.');
