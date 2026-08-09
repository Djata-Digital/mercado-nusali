import { Prisma } from '@prisma/client';

import { CartPricingService, CartPriceType } from './cart-pricing.service';
import { CartStockService, CartStockStatus } from './cart-stock.service';
import { CartSummaryService } from './cart-summary.service';

describe('CartSummaryService', () => {
  const service = new CartSummaryService(
    new CartPricingService(),
    new CartStockService(),
  );

  const createVariant = (overrides: Record<string, unknown> = {}) => ({
    price: new Prisma.Decimal('1500'),
    promotionalPrice: null,
    wholesalePrice: null,
    minimumWholesaleQuantity: null,
    weight: null,
    inventoryItems: [{ quantityAvailable: 10 }],
    ...overrides,
  });

  it('deve calcular subtotal, peso, volume, estoque e agrupamento por loja', () => {
    const cart = {
      id: 'cart-1',
      items: [
        {
          id: 'item-1',
          cartId: 'cart-1',
          productId: 'product-1',
          variantId: 'variant-1',
          storeId: 'store-1',
          quantity: 2,
          unitPriceSnapshot: new Prisma.Decimal('1500'),
          currencyId: 'currency-1',
          createdAt: new Date('2026-08-06T00:00:00.000Z'),
          updatedAt: new Date('2026-08-06T00:00:00.000Z'),
          product: {
            weight: new Prisma.Decimal('0.500'),
            length: new Prisma.Decimal('20'),
            width: new Prisma.Decimal('10'),
            height: new Prisma.Decimal('5'),
            store: { id: 'store-1' },
          },
          variant: createVariant(),
          store: { id: 'store-1', name: 'Loja 1' },
          currency: { id: 'currency-1', code: 'XOF' },
        },
      ],
    };

    const result = service.buildSummary(cart);

    expect(result.summary.totalItems).toBe(2);
    expect(result.summary.subtotal.toString()).toBe('3000');
    expect(result.summary.discountTotal.toString()).toBe('0');
    expect(result.summary.totalWeightKg.toString()).toBe('1');
    expect(result.summary.totalVolumeM3.toString()).toBe('0.002');
    expect(result.summary.storeCount).toBe(1);
    expect(result.summary.unavailableItems).toBe(0);
    expect(result.summary.lowStockItems).toBe(0);
    expect(result.summary.priceChangedItems).toBe(0);
    expect(result.stores).toHaveLength(1);
    expect(result.items[0].availability.availableStock).toBe(10);
    expect(result.items[0].availability.status).toBe(
      CartStockStatus.AVAILABLE,
    );
    expect(result.items[0].availability.maximumAllowedQuantity).toBe(10);
    expect(result.items[0].pricing.priceType).toBe(CartPriceType.REGULAR);
  });

  it('deve aplicar promoção e sinalizar mudança em relação ao snapshot', () => {
    const cart = {
      id: 'cart-price-change',
      items: [
        {
          id: 'item-price-change',
          cartId: 'cart-price-change',
          productId: 'product-1',
          variantId: 'variant-1',
          storeId: 'store-1',
          quantity: 2,
          unitPriceSnapshot: new Prisma.Decimal('1500'),
          currencyId: 'currency-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            weight: null,
            length: null,
            width: null,
            height: null,
            store: { id: 'store-1' },
          },
          variant: createVariant({
            promotionalPrice: new Prisma.Decimal('1200'),
          }),
          store: { id: 'store-1' },
          currency: { id: 'currency-1' },
        },
      ],
    };

    const result = service.buildSummary(cart);

    expect(result.summary.subtotal.toString()).toBe('2400');
    expect(result.summary.discountTotal.toString()).toBe('600');
    expect(result.summary.priceChangedItems).toBe(1);
    expect(result.items[0].pricing.priceChanged).toBe(true);
    expect(result.items[0].pricing.currentUnitPrice.toString()).toBe('1200');
  });

  it('deve marcar item como indisponível quando o estoque for menor que a quantidade', () => {
    const cart = {
      id: 'cart-2',
      items: [
        {
          id: 'item-2',
          cartId: 'cart-2',
          productId: 'product-2',
          variantId: 'variant-2',
          storeId: 'store-2',
          quantity: 5,
          unitPriceSnapshot: new Prisma.Decimal('100'),
          currencyId: 'currency-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          product: {
            weight: null,
            length: null,
            width: null,
            height: null,
            store: { id: 'store-2' },
          },
          variant: createVariant({
            price: new Prisma.Decimal('100'),
            inventoryItems: [{ quantityAvailable: 2 }],
          }),
          store: { id: 'store-2' },
          currency: { id: 'currency-1' },
        },
      ],
    };

    const result = service.buildSummary(cart);

    expect(result.summary.unavailableItems).toBe(1);
    expect(result.summary.lowStockItems).toBe(1);
    expect(result.items[0].availability.isAvailable).toBe(false);
    expect(result.items[0].availability.isLowStock).toBe(true);
    expect(result.items[0].availability.status).toBe(
      CartStockStatus.LOW_STOCK,
    );
  });

  it('não deve modificar o item original ao enriquecer o carrinho', () => {
    const originalItem = {
      id: 'item-3',
      cartId: 'cart-3',
      productId: 'product-3',
      variantId: 'variant-3',
      storeId: 'store-3',
      quantity: 1,
      unitPriceSnapshot: new Prisma.Decimal('200'),
      currencyId: 'currency-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      product: {
        weight: null,
        length: null,
        width: null,
        height: null,
        store: { id: 'store-3' },
      },
      variant: createVariant({ price: new Prisma.Decimal('200') }),
      store: { id: 'store-3' },
      currency: { id: 'currency-1' },
    };

    service.buildSummary({ id: 'cart-3', items: [originalItem] });

    expect(originalItem).not.toHaveProperty('itemSubtotal');
    expect(originalItem).not.toHaveProperty('availability');
    expect(originalItem).not.toHaveProperty('pricing');
  });
});
