import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Loader2, MapPin, Search, ShieldCheck, Star } from 'lucide-react';
import { StoresApi } from '../api/clients/StoresApi';

const rating = (value: string | number) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const StoresListPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const storesQuery = useQuery({
    queryKey: ['public-stores', search],
    queryFn: async () => {
      const response = await StoresApi.listPublic({
        page: 1,
        limit: 50,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      return response.data;
    },
  });

  const stores = storesQuery.data?.items || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Lojas do Mercado Nusali</h1>
          <p className="text-sm text-gray-500 mt-1">
            Apenas lojas ativas retornadas pelo catálogo público do marketplace.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar loja..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-emerald-600"
          />
        </div>
      </div>

      {storesQuery.isLoading ? (
        <div className="py-20 flex justify-center text-emerald-700">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      ) : storesQuery.isError ? (
        <div className="bg-white border border-red-200 rounded-2xl p-10 text-center">
          <Building2 className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <h2 className="font-bold text-gray-900">Não foi possível carregar as lojas.</h2>
          <p className="text-xs text-gray-500 mt-1">Verifique a API e tente novamente.</p>
        </div>
      ) : stores.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="font-bold text-gray-900">Nenhuma loja encontrada.</h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <button
              key={store.id}
              onClick={() => navigate(`/stores/${store.slug}`)}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden text-left hover:shadow-lg transition group"
            >
              <div className="h-28 bg-gradient-to-r from-blue-950 via-emerald-900 to-teal-900 relative overflow-hidden">
                {store.bannerUrl && (
                  <img
                    src={store.bannerUrl}
                    alt=""
                    className="w-full h-full object-cover opacity-55"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>

              <div className="p-5">
                <div className="flex gap-3 -mt-10 mb-4 relative z-10">
                  <div className="w-16 h-16 rounded-xl bg-emerald-600 border-4 border-white shadow-md overflow-hidden flex items-center justify-center text-white">
                    {store.logoUrl ? (
                      <img
                        src={store.logoUrl}
                        alt={store.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Building2 className="w-8 h-8" />
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-black text-gray-900 truncate group-hover:text-emerald-700">
                      {store.name}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {store.description || 'Sem descrição pública cadastrada.'}
                    </p>
                  </div>

                  {(store.isOfficial || store.seller?.status === 'VERIFIED') && (
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-gray-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                    {[store.city, store.region, store.country?.name].filter(Boolean).join(', ') || store.country?.code}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    {rating(store.averageRating).toFixed(1)} ({store.totalReviews || 0})
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
