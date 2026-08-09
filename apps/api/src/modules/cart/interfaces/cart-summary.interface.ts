import { Prisma } from '@prisma/client';

import { CartPriceType } from '../services/cart-pricing.service';
import { CartStockStatus } from '../services/cart-stock.service';

/**
 * Estado comercial calculado para um item do carrinho.
 *
 * Esta informação não é persistida. Ela representa uma fotografia do estado
 * atual do produto e do estoque no momento da consulta.
 */
export interface CartItemAvailabilitySummary {
  status: CartStockStatus;
  requestedQuantity: number;
  availableStock: number;
  maximumAllowedQuantity: number;
  remainingAfterRequest: number;
  activeWarehouseCount: number;
  isAvailable: boolean;
  isLowStock: boolean;
}

/**
 * Resultado de preço calculado para um item do carrinho.
 */
export interface CartItemPricingSummary {
  priceType: CartPriceType;
  originalUnitPrice: Prisma.Decimal;
  currentUnitPrice: Prisma.Decimal;
  previousUnitPrice: Prisma.Decimal;
  discountPerUnit: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  hasDiscount: boolean;
  priceChanged: boolean;
}

/**
 * Referência mínima da loja usada no agrupamento do carrinho.
 */
export interface CartStoreReference {
  id: string;
  countryId?: string | null;
  name?: string;
  code?: string;
  [key: string]: unknown;
}

/**
 * Item enriquecido retornado no resumo do carrinho.
 */
export interface EnrichedCartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId: string;
  storeId: string;
  quantity: number;
  unitPriceSnapshot: Prisma.Decimal;
  currencyId: string;
  createdAt: Date;
  updatedAt: Date;
  product: unknown;
  variant: unknown;
  store: CartStoreReference;
  currency: unknown;
  pricing: CartItemPricingSummary;
  itemSubtotal: Prisma.Decimal;
  itemWeightKg: Prisma.Decimal;
  itemVolumeM3: Prisma.Decimal;
  availability: CartItemAvailabilitySummary;
}

/**
 * Resumo dos itens pertencentes a uma única loja.
 */
export interface StoreCartSummary {
  store: CartStoreReference;
  items: EnrichedCartItem[];
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  weightKg: Prisma.Decimal;
  volumeM3: Prisma.Decimal;
}

/**
 * Totais gerais calculados para o carrinho.
 */
export interface CartTotalsSummary {
  totalItems: number;
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  totalWeightKg: Prisma.Decimal;
  totalVolumeM3: Prisma.Decimal;
  storeCount: number;
  unavailableItems: number;
  lowStockItems: number;
  priceChangedItems: number;
  estimatedShipping: Prisma.Decimal;
  estimatedTaxes: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  calculatedAt: Date;
}
