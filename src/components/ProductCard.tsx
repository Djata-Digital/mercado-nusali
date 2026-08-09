import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Star, ShoppingCart, ShieldCheck } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../hooks/useCart';
import { useFavorites } from '../hooks/useFavorites';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toggleFavorite, isFavorite } = useFavorites();
  const favorited = isFavorite(product.id);

  const openProductDetail = (id: string) => {
    navigate(`/products/${id}`);
  };

  const installmentAmount = (product.price / product.installmentsMax).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedPrice = product.price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedOriginalPrice = product.originalPrice?.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden group relative">
      {/* Top badges: Favorite button + Offer tag */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
        {product.offerOfDay ? (
          <span className="bg-[#fff159] text-blue-950 font-black text-[10px] px-2 py-0.5 rounded-xs tracking-wider shadow-xs uppercase pointer-events-auto">
            Oferta do dia
          </span>
        ) : (
          <span />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(product.id);
          }}
          className="p-1.5 bg-white/90 hover:bg-white rounded-full shadow-md text-gray-400 hover:text-red-500 transition pointer-events-auto"
          title={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart
            className={`w-4 h-4 ${favorited ? 'fill-red-500 text-red-500' : ''}`}
          />
        </button>
      </div>

      {/* Product Image */}
      <div
        onClick={() => openProductDetail(product.id)}
        className="cursor-pointer overflow-hidden p-4 bg-gray-50 flex items-center justify-center h-48 sm:h-52"
      >
        <img
          src={product.image}
          alt={product.title}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      {/* Card Info */}
      <div className="p-4 flex flex-col flex-1 justify-between border-t border-gray-100">
        <div>
          {/* Title */}
          <h3
            onClick={() => openProductDetail(product.id)}
            className="text-xs sm:text-sm font-normal text-gray-800 hover:text-blue-600 line-clamp-2 cursor-pointer mb-2 leading-snug"
            title={product.title}
          >
            {product.title}
          </h3>

          {/* Price Block */}
          <div className="space-y-0.5">
            {product.originalPrice && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 line-through">
                  R$ {formattedOriginalPrice}
                </span>
                {product.discountPercentage && (
                  <span className="text-xs font-semibold text-green-600">
                    {product.discountPercentage}% OFF
                  </span>
                )}
              </div>
            )}

            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                R$ {formattedPrice}
              </span>
            </div>

            {/* Installment Badge */}
            <p className="text-[11px] text-green-700 font-medium">
              em {product.installmentsMax}x R$ {installmentAmount}{' '}
              {product.installmentsInterestFree && 'sem juros'}
            </p>
          </div>

          {/* Shipping Badges */}
          <div className="mt-2 space-y-1">
            {product.shipping.freeShipping && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-700">
                <span>⚡ FRETE GRÁTIS</span>
                {product.shipping.fullFulfilled && (
                  <span className="bg-green-600 text-white font-black text-[9px] px-1 py-0.2 rounded-xs uppercase tracking-wider">
                    FULL
                  </span>
                )}
              </div>
            )}

            {product.shipping.arrivesTomorrow && (
              <p className="text-[11px] font-semibold text-green-700">
                Chega amanhã
              </p>
            )}
          </div>

          {/* Seller reputation badge */}
          {product.seller.isOfficialStore && (
            <p className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              Por {product.seller.name}
            </p>
          )}

          {/* Star Rating */}
          <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-500">
            <div className="flex items-center text-amber-400">
              <Star className="w-3 h-3 fill-amber-400" />
              <span className="ml-1 font-bold text-gray-800">{product.rating}</span>
            </div>
            <span>({product.reviewsCount})</span>
          </div>
        </div>

        {/* Quick Add to Cart Button */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-medium text-gray-400 uppercase">
            {product.condition === 'novo' ? 'Novo' : 'Usado'}
          </span>
          <button
            onClick={() => addItem(product, 1)}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white px-3 py-1.5 rounded-md text-xs font-semibold transition"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
