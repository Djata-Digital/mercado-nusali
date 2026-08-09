import { Prisma } from '@prisma/client';

import { CartPricingService, CartPriceType } from './cart-pricing.service';

describe('CartPricingService', () => {
  const service = new CartPricingService();

  const variant = {
    price: new Prisma.Decimal('1000'),
    promotionalPrice: new Prisma.Decimal('900'),
    wholesalePrice: new Prisma.Decimal('800'),
    minimumWholesaleQuantity: 10,
  };

  it('deve aplicar preço regular quando não existir desconto válido', () => {
    const result = service.resolveUnitPrice(
      {
        price: new Prisma.Decimal('1000'),
        promotionalPrice: null,
        wholesalePrice: null,
        minimumWholesaleQuantity: null,
      },
      1,
    );

    expect(result.priceType).toBe(CartPriceType.REGULAR);
    expect(result.currentUnitPrice.toString()).toBe('1000');
  });

  it('deve aplicar preço promocional antes da quantidade mínima de atacado', () => {
    const result = service.resolveUnitPrice(variant, 2);

    expect(result.priceType).toBe(CartPriceType.PROMOTIONAL);
    expect(result.currentUnitPrice.toString()).toBe('900');
  });

  it('deve priorizar preço de atacado quando a quantidade mínima for atingida', () => {
    const result = service.resolveUnitPrice(variant, 10);

    expect(result.priceType).toBe(CartPriceType.WHOLESALE);
    expect(result.currentUnitPrice.toString()).toBe('800');
  });

  it('deve ignorar preço promocional maior que o preço regular', () => {
    const result = service.resolveUnitPrice(
      {
        ...variant,
        promotionalPrice: new Prisma.Decimal('1100'),
        wholesalePrice: null,
        minimumWholesaleQuantity: null,
      },
      1,
    );

    expect(result.priceType).toBe(CartPriceType.REGULAR);
    expect(result.currentUnitPrice.toString()).toBe('1000');
  });

  it('deve detectar mudança de preço e calcular desconto e subtotal', () => {
    const result = service.calculateItemPrice(
      variant,
      2,
      new Prisma.Decimal('1000'),
    );

    expect(result.priceChanged).toBe(true);
    expect(result.discountPerUnit.toString()).toBe('100');
    expect(result.discountTotal.toString()).toBe('200');
    expect(result.subtotal.toString()).toBe('1800');
  });
});
