import { Injectable } from '@nestjs/common';
import { Prisma, WarehouseStatus } from '@prisma/client';

import {
  CartStoreReference,
  CartTotalsSummary,
  EnrichedCartItem,
  StoreCartSummary,
} from '../interfaces/cart-summary.interface';
import { CartPricingService } from './cart-pricing.service';
import { CartStockService } from './cart-stock.service';

/**
 * Estrutura mínima esperada pelo serviço para calcular o resumo do carrinho.
 */
interface CartItemForSummary {
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
  product: {
    weight: Prisma.Decimal | null;
    length: Prisma.Decimal | null;
    width: Prisma.Decimal | null;
    height: Prisma.Decimal | null;
    store: unknown;
  };
  variant: {
    price: Prisma.Decimal;
    promotionalPrice: Prisma.Decimal | null;
    wholesalePrice: Prisma.Decimal | null;
    minimumWholesaleQuantity: number | null;
    weight: Prisma.Decimal | null;
    inventoryItems: Array<{
      quantityAvailable: number;
      reorderPoint?: number | null;
      warehouse?: {
        status: WarehouseStatus;
      } | null;
    }>;
  };
  store: CartStoreReference;
  currency: unknown;
}

interface CartForSummary {
  items: CartItemForSummary[];
  [key: string]: unknown;
}

/**
 * CartSummaryService
 *
 * Responsável por recalcular os totais e o agrupamento comercial do carrinho.
 * A escolha do preço atual é delegada ao CartPricingService.
 */
@Injectable()
export class CartSummaryService {
  private readonly zero = new Prisma.Decimal(0);

  constructor(
    private readonly cartPricingService: CartPricingService,
    private readonly cartStockService: CartStockService,
  ) {}

  /**
   * Enriquece o carrinho sem modificar o objeto original.
   */
  buildSummary<TCart extends CartForSummary>(
    cart: TCart,
  ): Omit<TCart, 'items'> & {
    items: EnrichedCartItem[];
    summary: CartTotalsSummary;
    stores: StoreCartSummary[];
  } {
    const enrichedItems = cart.items.map((item) => this.enrichItem(item));
    const stores = this.groupItemsByStore(enrichedItems);
    const summary = this.calculateTotals(enrichedItems, stores.length);

    return {
      ...cart,
      items: enrichedItems,
      summary,
      stores,
    };
  }

  /**
   * Calcula os totais gerais do carrinho usando os preços atuais.
   */
  calculateTotals(
    items: EnrichedCartItem[],
    storeCount: number,
  ): CartTotalsSummary {
    const subtotal = items.reduce(
      (total, item) => total.plus(item.itemSubtotal),
      this.zero,
    );

    const discountTotal = items.reduce(
      (total, item) => total.plus(item.pricing.discountTotal),
      this.zero,
    );

    const totalWeightKg = items.reduce(
      (total, item) => total.plus(item.itemWeightKg),
      this.zero,
    );

    const totalVolumeM3 = items.reduce(
      (total, item) => total.plus(item.itemVolumeM3),
      this.zero,
    );

    const totalItems = items.reduce(
      (total, item) => total + item.quantity,
      0,
    );

    const unavailableItems = items.filter(
      (item) => !item.availability.isAvailable,
    ).length;

    const lowStockItems = items.filter(
      (item) => item.availability.isLowStock,
    ).length;

    const priceChangedItems = items.filter(
      (item) => item.pricing.priceChanged,
    ).length;

    const estimatedShipping = this.zero;
    const estimatedTaxes = this.zero;

    return {
      totalItems,
      subtotal,
      discountTotal,
      totalWeightKg,
      totalVolumeM3,
      storeCount,
      unavailableItems,
      lowStockItems,
      priceChangedItems,
      estimatedShipping,
      estimatedTaxes,
      grandTotal: subtotal.plus(estimatedShipping).plus(estimatedTaxes),
      calculatedAt: new Date(),
    };
  }

  /**
   * Agrupa itens por loja e calcula subtotal, desconto, peso e volume.
   */
  groupItemsByStore(items: EnrichedCartItem[]): StoreCartSummary[] {
    const stores = new Map<string, StoreCartSummary>();

    for (const item of items) {
      const current = stores.get(item.storeId) ?? {
        store: item.store,
        items: [],
        subtotal: this.zero,
        discountTotal: this.zero,
        weightKg: this.zero,
        volumeM3: this.zero,
      };

      current.items.push(item);
      current.subtotal = current.subtotal.plus(item.itemSubtotal);
      current.discountTotal = current.discountTotal.plus(
        item.pricing.discountTotal,
      );
      current.weightKg = current.weightKg.plus(item.itemWeightKg);
      current.volumeM3 = current.volumeM3.plus(item.itemVolumeM3);

      stores.set(item.storeId, current);
    }

    return Array.from(stores.values());
  }

  /**
   * Calcula os dados derivados de um item do carrinho.
   */
  private enrichItem(item: CartItemForSummary): EnrichedCartItem {
    const quantity = Math.max(0, item.quantity);
    const pricing = this.cartPricingService.calculateItemPrice(
      item.variant,
      quantity,
      item.unitPriceSnapshot,
    );

    const unitWeightKg = new Prisma.Decimal(
      item.variant.weight ?? item.product.weight ?? 0,
    );

    const itemWeightKg = unitWeightKg.mul(quantity);
    const itemVolumeM3 = this.calculateItemVolumeM3(item, quantity);
    const stock = this.cartStockService.evaluate({
      inventoryItems: item.variant.inventoryItems,
      requestedQuantity: quantity,
    });

    return {
      ...item,
      pricing: {
        priceType: pricing.priceType,
        originalUnitPrice: pricing.originalUnitPrice,
        currentUnitPrice: pricing.currentUnitPrice,
        previousUnitPrice: pricing.previousUnitPrice,
        discountPerUnit: pricing.discountPerUnit,
        discountTotal: pricing.discountTotal,
        hasDiscount: pricing.hasDiscount,
        priceChanged: pricing.priceChanged,
      },
      itemSubtotal: pricing.subtotal,
      itemWeightKg,
      itemVolumeM3,
      availability: {
        status: stock.status,
        requestedQuantity: stock.requestedQuantity,
        availableStock: stock.availableQuantity,
        maximumAllowedQuantity: stock.maximumAllowedQuantity,
        remainingAfterRequest: stock.remainingAfterRequest,
        activeWarehouseCount: stock.activeWarehouseCount,
        isAvailable: stock.isAvailable,
        isLowStock: stock.isLowStock,
      },
    };
  }

  /**
   * Converte dimensões em centímetros para volume em metros cúbicos.
   */
  private calculateItemVolumeM3(
    item: CartItemForSummary,
    quantity: number,
  ): Prisma.Decimal {
    const lengthCm = new Prisma.Decimal(item.product.length ?? 0);
    const widthCm = new Prisma.Decimal(item.product.width ?? 0);
    const heightCm = new Prisma.Decimal(item.product.height ?? 0);

    if (
      lengthCm.lte(0) ||
      widthCm.lte(0) ||
      heightCm.lte(0) ||
      quantity <= 0
    ) {
      return this.zero;
    }

    return lengthCm
      .mul(widthCm)
      .mul(heightCm)
      .div(1_000_000)
      .mul(quantity);
  }
}
