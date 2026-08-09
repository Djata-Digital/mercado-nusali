import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../context/AuthContext';
import { Trash2, ShieldCheck, ArrowRight, Tag, ShoppingBag, AlertTriangle, Loader2 } from 'lucide-react';

const money = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${currency}`;
  }
};

export const CartView: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const {
    items: cart,
    removeItem: removeFromCart,
    updateQuantity: updateCartQuantity,
    total: cartTotal,
    totalCount: cartItemCount,
    currency,
    coupon,
    warnings,
    isLoading,
    error,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponMessage('');
    if (!couponCode.trim()) return;
    const ok = await applyCoupon(couponCode);
    if (ok) {
      setCouponMessage('Cupom validado e aplicado pelo servidor.');
      setCouponCode('');
    }
  };

  if (isLoading && cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold">Carregando seu carrinho...</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto text-yellow-700">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">Seu carrinho está vazio</h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto">Explore o catálogo e adicione produtos disponíveis.</p>
        {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
        <button onClick={() => navigate('/products')} className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-8 py-3 rounded-md shadow-md text-sm transition">
          Ver produtos
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-gray-900">Carrinho de Compras ({cartItemCount})</h1>
        {isLoading && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
      </div>

      {!isAuthenticated && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 font-medium">
          Seu carrinho de visitante será sincronizado com o carrinho real da sua conta quando você entrar.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-semibold flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
          {warnings.map((warning) => <p key={warning}>• {warning}</p>)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200 shadow-xs">
            {cart.map((item) => (
              <div key={`${item.product.id}-${item.product.variantId || ''}`} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  {item.product.image ? (
                    <img src={item.product.image} alt={item.product.title} className="w-20 h-20 object-contain rounded-md bg-gray-50 p-1 border border-gray-200 shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-md bg-gray-50 border border-gray-200 shrink-0 flex items-center justify-center text-gray-400">
                      <ShoppingBag className="w-7 h-7" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{item.product.title}</h3>
                    <p className="text-xs text-gray-500">Vendido por <strong className="text-gray-800">{item.product.storeName || item.product.seller.name}</strong></p>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-none border-gray-100">
                  <div className="flex items-center border border-gray-300 rounded-md overflow-hidden bg-gray-50">
                    <button disabled={isLoading} onClick={() => void updateCartQuantity(item.product.id, item.quantity - 1)} className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 font-bold disabled:opacity-50">-</button>
                    <span className="px-3 py-1 text-xs font-bold text-gray-900">{item.quantity}</span>
                    <button disabled={isLoading} onClick={() => void updateCartQuantity(item.product.id, item.quantity + 1)} className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 font-bold disabled:opacity-50">+</button>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-gray-900">{money(item.product.price * item.quantity, currency)}</span>
                    <p className="text-[10px] text-gray-400">{money(item.product.price, currency)} un.</p>
                  </div>
                  <button disabled={isLoading} onClick={() => void removeFromCart(item.product.id)} className="text-gray-400 hover:text-red-600 p-1 transition disabled:opacity-50" title="Excluir item">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <Tag className="w-4 h-4 text-emerald-600" />
              <span>Use somente cupons cadastrados e ativos na plataforma.</span>
            </div>
            {coupon ? (
              <div className="flex items-center justify-between gap-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs">
                <span className="font-bold text-green-800">Cupom {coupon.code} aplicado</span>
                <button disabled={isLoading} onClick={() => void removeCoupon()} className="font-bold text-red-600 hover:underline">Remover</button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2 w-full sm:max-w-md">
                <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Código do cupom" className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 uppercase font-semibold" />
                <button disabled={isLoading} type="submit" className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-md transition">Aplicar</button>
              </form>
            )}
            {couponMessage && <p className="text-xs text-green-700 font-bold">✓ {couponMessage}</p>}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-3">Resumo da compra</h2>
            <div className="space-y-2 text-xs text-gray-700">
              <div className="flex justify-between"><span>Produtos ({cartItemCount}):</span><span className="font-semibold text-gray-900">{money(cartTotal, currency)}</span></div>
              <div className="flex justify-between"><span>Frete:</span><span className="font-semibold text-gray-700">Calculado no checkout</span></div>
              <div className="flex justify-between"><span>Impostos/taxas:</span><span className="font-semibold text-gray-700">Calculados no checkout</span></div>
            </div>
            <div className="pt-3 border-t border-gray-200 flex justify-between items-baseline">
              <span className="text-base font-bold text-gray-900">Subtotal:</span>
              <span className="text-2xl font-black text-gray-900">{money(cartTotal, currency)}</span>
            </div>
            <button onClick={() => navigate('/checkout')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 px-4 rounded-md shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 text-sm">
              <span>Continuar a compra</span><ArrowRight className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-2 border-t border-gray-100">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Valores finais serão validados pelo servidor antes da confirmação do pedido.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
