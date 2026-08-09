import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CartItem, Product } from '../types';
import { CartService } from '../services/cartService';
import { CartApi } from '../api/clients/CartApi';
import { ProductService } from '../services/productService';
import { useAuth } from './AuthContext';

interface RealCartCoupon {
  id: string;
  code: string;
  type?: string;
  value?: string;
}

interface CartContextValue {
  items: CartItem[];
  total: number;
  totalCount: number;
  currency: string;
  coupon: RealCartCoupon | null;
  warnings: string[];
  isLoading: boolean;
  error: string | null;
  isServerCart: boolean;
  addItem: (product: Product, quantity?: number, options?: { color?: string; storage?: string }) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);
const productCache = new Map<string, Product>();

type ServerCartItem = {
  id: string;
  productId: string;
  productTitle: string;
  productSlug?: string;
  variantId: string;
  variantName?: string;
  quantity: number;
  unitPrice: string | number;
};

const createMinimalProduct = (item: ServerCartItem, store: any, currency: string): Product => ({
  id: item.productId,
  slug: item.productSlug,
  variantId: item.variantId,
  title: item.productTitle,
  price: Number(item.unitPrice || 0),
  currency: currency as any,
  installmentsMax: 1,
  installmentsInterestFree: true,
  image: '',
  galleryImages: [],
  category: '',
  categorySlug: '',
  condition: 'novo',
  brand: '',
  model: '',
  rating: 0,
  reviewsCount: 0,
  seller: {
    id: String(store?.id || ''),
    name: String(store?.name || 'Vendedor'),
    reputationLevel: 'bom',
    reputationScore: 0,
    salesCount: 0,
    isOfficialStore: false,
    kycStatus: 'verified',
    country: 'GW',
    location: { city: '', state: '' },
    goodService: true,
    onTimeDelivery: true,
  },
  storeId: store?.id,
  storeName: store?.name,
  shipping: {
    freeShipping: false,
    arrivesTomorrow: false,
    shippingPrice: 0,
    fullFulfilled: false,
  },
  stock: 0,
  salesCount: 0,
  description: '',
  specs: {},
  questions: [],
  reviews: [],
});

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => CartService.getCart());
  const [serverItemIds, setServerItemIds] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState('XOF');
  const [coupon, setCoupon] = useState<RealCartCoupon | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [serverSubtotal, setServerSubtotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrateServerCart = useCallback(async (response: any) => {
    const data = response?.data ?? response;
    const groups = Array.isArray(data?.stores) ? data.stores : [];
    const flat = groups.flatMap((group: any) =>
      (group.items || []).map((item: ServerCartItem) => ({ item, store: group.store }))
    );

    const hydrated = await Promise.all(flat.map(async ({ item, store }: any) => {
      let product = productCache.get(item.variantId);
      if (!product && item.productSlug) {
        try {
          const res = await ProductService.getProductBySlug(item.productSlug);
          product = res.data || undefined;
        } catch {
          product = undefined;
        }
      }
      if (!product) product = createMinimalProduct(item, store, data?.currency || 'XOF');
      product = {
        ...product,
        variantId: item.variantId,
        slug: product.slug || item.productSlug,
        price: Number(item.unitPrice || product.price || 0),
        currency: (data?.currency || product.currency || 'XOF') as any,
        storeId: product.storeId || store?.id,
        storeName: product.storeName || store?.name,
      };
      productCache.set(item.variantId, product);
      return { product, quantity: item.quantity } as CartItem;
    }));

    const ids: Record<string, string> = {};
    flat.forEach(({ item }: any) => { ids[item.productId] = item.id; });
    setServerItemIds(ids);
    setItems(hydrated);
    setCurrency(String(data?.currency || 'XOF'));
    setCoupon(data?.coupon || null);
    setWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
    setServerSubtotal(Number(data?.subtotal || 0));
  }, []);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      const guest = CartService.getCart();
      setItems(guest);
      setServerItemIds({});
      setCoupon(null);
      setWarnings([]);
      setServerSubtotal(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await CartApi.get();
      await hydrateServerCart(res);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Não foi possível carregar o carrinho.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [hydrateServerCart, isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const sync = async () => {
      if (!isAuthenticated) {
        if (!cancelled) await refreshCart();
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const guest = CartService.getCart();
        const mergeable = guest
          .filter((entry) => Boolean(entry.product.variantId))
          .map((entry) => ({ variantId: entry.product.variantId!, quantity: entry.quantity }));
        const res = mergeable.length ? await CartApi.merge({ items: mergeable }) : await CartApi.get();
        if (mergeable.length) CartService.clearCart();
        if (!cancelled) await hydrateServerCart(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message || e?.message || 'Não foi possível sincronizar o carrinho.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    sync();
    return () => { cancelled = true; };
  }, [authLoading, hydrateServerCart, isAuthenticated, refreshCart]);

  const addItem = useCallback(async (product: Product, quantity = 1, options?: { color?: string; storage?: string }) => {
    setError(null);
    if (!product.variantId) {
      setError('Este produto ainda não possui uma variante comercial ativa.');
      return;
    }
    productCache.set(product.variantId, product);
    if (!isAuthenticated) {
      const updated = CartService.addItem(product, quantity, options);
      setItems([...updated]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await CartApi.addItem(product.variantId, quantity);
      await hydrateServerCart(res);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Não foi possível adicionar o produto ao carrinho.');
    } finally {
      setIsLoading(false);
    }
  }, [hydrateServerCart, isAuthenticated]);

  const removeItemInternal = useCallback(async (productId: string, _item?: CartItem) => {
    if (!isAuthenticated) {
      setItems([...CartService.removeItem(productId)]);
      return;
    }
    const itemId = serverItemIds[productId];
    if (!itemId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await CartApi.removeItem(itemId);
      await hydrateServerCart(res);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Não foi possível remover o item.');
    } finally {
      setIsLoading(false);
    }
  }, [hydrateServerCart, isAuthenticated, serverItemIds]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      const item = items.find((x) => x.product.id === productId);
      if (item) await removeItemInternal(productId, item);
      return;
    }
    if (!isAuthenticated) {
      setItems([...CartService.updateQuantity(productId, quantity)]);
      return;
    }
    const itemId = serverItemIds[productId];
    if (!itemId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await CartApi.updateItem(itemId, quantity);
      await hydrateServerCart(res);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Não foi possível atualizar o carrinho.');
    } finally {
      setIsLoading(false);
    }
  }, [hydrateServerCart, isAuthenticated, items, serverItemIds, removeItemInternal]);

  const removeItem = useCallback(async (productId: string) => {
    await removeItemInternal(productId);
  }, [removeItemInternal]);

  const clearCart = useCallback(async () => {
    if (!isAuthenticated) {
      CartService.clearCart();
      setItems([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await CartApi.clear();
      await hydrateServerCart(res);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Não foi possível esvaziar o carrinho.');
    } finally {
      setIsLoading(false);
    }
  }, [hydrateServerCart, isAuthenticated]);

  const applyCoupon = useCallback(async (code: string) => {
    if (!isAuthenticated) {
      setError('Entre na sua conta para aplicar um cupom real.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await CartApi.applyCoupon(code.trim());
      await hydrateServerCart(res);
      return true;
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Cupom inválido ou indisponível.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [hydrateServerCart, isAuthenticated]);

  const removeCoupon = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await CartApi.removeCoupon();
      await hydrateServerCart(res);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Não foi possível remover o cupom.');
    } finally {
      setIsLoading(false);
    }
  }, [hydrateServerCart, isAuthenticated]);

  const localTotal = items.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const total = isAuthenticated && serverSubtotal !== null ? serverSubtotal : localTotal;
  const totalCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const value = useMemo<CartContextValue>(() => ({
    items, total, totalCount, currency, coupon, warnings, isLoading, error,
    isServerCart: isAuthenticated,
    addItem, updateQuantity, removeItem, clearCart, applyCoupon, removeCoupon, refreshCart,
  }), [items, total, totalCount, currency, coupon, warnings, isLoading, error, isAuthenticated, addItem, updateQuantity, removeItem, clearCart, applyCoupon, removeCoupon, refreshCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCartContext = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
