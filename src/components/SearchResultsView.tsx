import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from './ProductCard';
import { SlidersHorizontal, ArrowUpDown, X, Check } from 'lucide-react';
import { ProductCondition, FilterState } from '../types';

export const SearchResultsView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const { data: products = [] } = useProducts();

  const [filterState, setFilterState] = useState<FilterState>({
    query: queryParam,
    category: '',
    brand: '',
    priceMin: undefined,
    priceMax: undefined,
    condition: 'all',
    freeShippingOnly: false,
    fullOnly: false,
    arrivesTomorrowOnly: false,
    sellerPlatinumOnly: false,
    officialStoresOnly: false,
    sortBy: 'relevance',
  });

  const updateFilterState = (patch: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...patch }));
  };

  const resetFilters = () => {
    setFilterState({
      query: '',
      category: '',
      brand: '',
      priceMin: undefined,
      priceMax: undefined,
      condition: 'all',
      freeShippingOnly: false,
      fullOnly: false,
      arrivesTomorrowOnly: false,
      sellerPlatinumOnly: false,
      officialStoresOnly: false,
      sortBy: 'relevance',
    });
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Query filter
      if (filterState.query) {
        const queryLower = filterState.query.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(queryLower);
        const matchesBrand = p.brand.toLowerCase().includes(queryLower);
        const matchesCategory = p.category.toLowerCase().includes(queryLower);
        if (!matchesTitle && !matchesBrand && !matchesCategory) return false;
      }

      // Category filter
      if (filterState.category) {
        if (p.categorySlug !== filterState.category && !p.category.toLowerCase().includes(filterState.category.toLowerCase())) {
          return false;
        }
      }

      // Condition filter
      if (filterState.condition && filterState.condition !== 'all') {
        if (p.condition !== filterState.condition) return false;
      }

      // Price filter
      if (filterState.priceMin !== undefined && p.price < filterState.priceMin) return false;
      if (filterState.priceMax !== undefined && p.price > filterState.priceMax) return false;

      // Free shipping
      if (filterState.freeShippingOnly && !p.shipping.freeShipping) return false;

      // Arrives tomorrow
      if (filterState.arrivesTomorrowOnly && !p.shipping.arrivesTomorrow) return false;

      // FULL
      if (filterState.fullOnly && !p.shipping.fullFulfilled) return false;

      // Seller Platinum
      if (filterState.sellerPlatinumOnly && p.seller.reputationLevel !== 'platinum') return false;

      return true;
    }).sort((a, b) => {
      if (filterState.sortBy === 'price_asc') return a.price - b.price;
      if (filterState.sortBy === 'price_desc') return b.price - a.price;
      if (filterState.sortBy === 'sales') return b.salesCount - a.salesCount;
      if (filterState.sortBy === 'rating') return b.rating - a.rating;
      return 0; // relevance
    });
  }, [products, filterState]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            {filterState.query ? `Resultados para "${filterState.query}"` : 'Todos os Produtos e Ofertas'}
          </h1>
          <p className="text-xs text-gray-500">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" /> Ordenar por:
          </label>
          <select
            value={filterState.sortBy}
            onChange={(e) => updateFilterState({ sortBy: e.target.value as any })}
            className="bg-gray-50 border border-gray-300 text-gray-800 text-xs rounded-md px-3 py-1.5 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="relevance">Mais relevantes</option>
            <option value="price_asc">Menor preço</option>
            <option value="price_desc">Maior preço</option>
            <option value="sales">Mais vendidos</option>
            <option value="rating">Melhor avaliação</option>
          </select>
        </div>
      </div>

      {/* Grid Layout: Left Sidebar Filters + Right Product Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Filters (3 cols) */}
        <div className="lg:col-span-3 space-y-6 bg-white p-5 rounded-lg border border-gray-200 shadow-xs h-fit">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" /> Filtros
            </h2>
            <button
              onClick={resetFilters}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              Limpar todos
            </button>
          </div>

          {/* Shipping Badges Toggles */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Envio</h3>

            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filterState.freeShippingOnly}
                onChange={(e) => updateFilterState({ freeShippingOnly: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded-xs border-gray-300 focus:ring-blue-500"
              />
              <span className="font-semibold text-green-700">⚡ Frete Grátis</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filterState.arrivesTomorrowOnly}
                onChange={(e) => updateFilterState({ arrivesTomorrowOnly: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded-xs border-gray-300 focus:ring-blue-500"
              />
              <span className="font-semibold text-green-700">⚡ Chega amanhã</span>
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filterState.fullOnly}
                onChange={(e) => updateFilterState({ fullOnly: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded-xs border-gray-300 focus:ring-blue-500"
              />
              <span className="font-extrabold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-xs border border-green-200">
                FULL
              </span>
            </label>
          </div>

          {/* Condition (Novo / Usado) */}
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Condição</h3>
            <div className="space-y-1.5 text-xs text-gray-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="condition"
                  checked={filterState.condition === 'all'}
                  onChange={() => updateFilterState({ condition: 'all' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Todos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="condition"
                  checked={filterState.condition === 'novo'}
                  onChange={() => updateFilterState({ condition: 'novo' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Novo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="condition"
                  checked={filterState.condition === 'usado'}
                  onChange={() => updateFilterState({ condition: 'usado' })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Usado</span>
              </label>
            </div>
          </div>

          {/* Seller Reputation */}
          <div className="space-y-2 pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Vendedor</h3>
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filterState.sellerPlatinumOnly}
                onChange={(e) => updateFilterState({ sellerPlatinumOnly: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded-xs border-gray-300 focus:ring-blue-500"
              />
              <span className="font-semibold text-green-700">MercadoLíder Platinum</span>
            </label>
          </div>
        </div>

        {/* Product Results Grid (9 cols) */}
        <div className="lg:col-span-9">
          {filteredProducts.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-lg border border-gray-200 space-y-4">
              <p className="text-gray-500 text-sm font-medium">
                Nenhum produto encontrado com os filtros selecionados.
              </p>
              <button
                onClick={resetFilters}
                className="bg-blue-600 text-white font-bold px-5 py-2 rounded-md text-xs hover:bg-blue-700 transition"
              >
                Limpar filtros e ver todos os produtos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
