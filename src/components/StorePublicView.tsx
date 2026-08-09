import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Loader2,
  MapPin,
  Package,
  Search,
  Share2,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { ProductCard } from './ProductCard';
import { StoresApi } from '../api/clients/StoresApi';
import { ProductsApi } from '../api/clients/ProductsApi';
import { mapPublicProduct } from '../api/adapters/publicCatalog';

const numberValue = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const StorePublicView: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'catalog' | 'about' | 'reviews'>('catalog');
  const [searchFilter, setSearchFilter] = useState('');

  const storeQuery = useQuery({
    queryKey: ['public-store', slug],
    queryFn: async () => {
      const response = await StoresApi.getPublicBySlug(slug);
      return response.data;
    },
    enabled: Boolean(slug),
  });

  const store = storeQuery.data;

  const productsQuery = useQuery({
    queryKey: ['public-store-products', store?.id],
    queryFn: async () => {
      const response = await ProductsApi.listPublic({
        storeId: store!.id,
        page: 1,
        limit: 100,
      });
      const raw: any = response.data;
      const items = Array.isArray(raw?.items) ? raw.items : [];
      return {
        items: items.map(mapPublicProduct),
        total: Number(raw?.total || items.length),
      };
    },
    enabled: Boolean(store?.id),
  });

  if (storeQuery.isLoading) {
    return (
      <div className="py-20 flex justify-center text-emerald-700">
        <Loader2 className="w-7 h-7 animate-spin" />
      </div>
    );
  }

  if (storeQuery.isError || !store) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Loja não encontrada ou inativa.</h2>
        <button
          onClick={() => navigate('/stores')}
          className="mt-5 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold"
        >
          Ver lojas
        </button>
      </div>
    );
  }

  const products = productsQuery.data?.items || [];
  const filteredStoreProducts = products.filter(
    (product) =>
      product.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      product.category.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  const storeRating = numberValue(store.averageRating);
  const sellerRating = numberValue(store.seller?.averageRating);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard pode ser bloqueado pelo navegador; não há fallback comercial fictício.
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
      <div className="relative h-48 sm:h-64 rounded-2xl overflow-hidden bg-gradient-to-r from-blue-950 via-emerald-900 to-teal-900 border border-gray-200 shadow-md mb-6">
        {store.bannerUrl && (
          <img
            src={store.bannerUrl}
            alt={store.name}
            className="w-full h-full object-cover opacity-45"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-4 right-4">
          <button
            onClick={() => void handleShare()}
            className="bg-white/90 hover:bg-white text-gray-900 p-2 rounded-full shadow-md"
            title="Copiar link da loja"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-8 -mt-16 relative z-10 mx-2 sm:mx-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg border-4 border-white overflow-hidden shrink-0">
              {store.logoUrl ? (
                <img
                  src={store.logoUrl}
                  alt={store.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Building2 className="w-10 h-10" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-gray-900">{store.name}</h1>
                {store.seller?.status === 'VERIFIED' && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300">
                    <ShieldCheck className="w-3 h-3" /> VENDEDOR VERIFICADO
                  </span>
                )}
                {store.isOfficial && (
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-200">
                    LOJA OFICIAL
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-600 mt-1 max-w-xl">
                {store.description || 'Sem descrição pública cadastrada.'}
              </p>

              <div className="flex items-center gap-4 mt-3 text-xs text-gray-600 flex-wrap">
                <span className="flex items-center gap-1 font-semibold text-gray-900">
                  <Star className="w-4 h-4 text-amber-500" />
                  {storeRating.toFixed(1)} / 5.0 ({store.totalReviews || 0} avaliações)
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  {[store.city, store.region, store.country?.name].filter(Boolean).join(', ') || store.country?.code}
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            {store.seller?.totalSales != null && (
              <span>
                Vendas registradas do vendedor: <strong className="text-gray-900">{store.seller.totalSales}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6 flex items-center gap-8 text-sm font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 border-b-2 whitespace-nowrap ${
            activeTab === 'catalog'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Catálogo ({productsQuery.data?.total ?? products.length})
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`pb-3 border-b-2 whitespace-nowrap ${
            activeTab === 'about'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500'
          }`}
        >
          <Building2 className="w-4 h-4 inline mr-2" /> Sobre
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`pb-3 border-b-2 whitespace-nowrap ${
            activeTab === 'reviews'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500'
          }`}
        >
          <Star className="w-4 h-4 inline mr-2" /> Reputação
        </button>
      </div>

      {activeTab === 'catalog' && (
        <div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder={`Buscar dentro de ${store.name}...`}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {productsQuery.isLoading ? (
            <div className="py-14 flex justify-center text-emerald-700">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : productsQuery.isError ? (
            <div className="bg-white border border-red-200 rounded-2xl p-10 text-center text-sm text-gray-600">
              Não foi possível carregar o catálogo desta loja.
            </div>
          ) : filteredStoreProducts.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredStoreProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-bold text-gray-800">Nenhum produto encontrado nesta loja.</h3>
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-5">
          <h3 className="text-xl font-bold text-gray-900">Informações públicas</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {store.description || 'Esta loja ainda não cadastrou uma descrição pública.'}
          </p>

          <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100 text-xs">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="font-black text-gray-900">Status da loja</div>
              <div className="text-emerald-800 mt-1">{store.status}</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="font-black text-gray-900">País</div>
              <div className="text-blue-800 mt-1">{store.country?.name || store.country?.code}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="font-black text-gray-900">Vendedor</div>
              <div className="text-purple-800 mt-1">{store.seller?.status || 'Não informado'}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-gray-500">Avaliação da loja</div>
              <div className="text-4xl font-black text-gray-900 mt-1">{storeRating.toFixed(1)}</div>
              <div className="text-xs text-gray-500 mt-1">{store.totalReviews || 0} avaliações registradas</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Avaliação do vendedor</div>
              <div className="text-4xl font-black text-gray-900 mt-1">{sellerRating.toFixed(1)}</div>
              <div className="text-xs text-gray-500 mt-1">{store.seller?.totalReviews || 0} avaliações registradas</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
            O backend público atual fornece os agregados reais de reputação, mas ainda não expõe uma
            lista pública de comentários individuais da loja. Nenhum depoimento fictício é exibido.
          </div>
        </div>
      )}
    </div>
  );
};
