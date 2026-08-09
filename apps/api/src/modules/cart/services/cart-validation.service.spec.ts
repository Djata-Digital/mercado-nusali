import { ConflictException } from '@nestjs/common';
import {
  ProductStatus,
  ProductVariantStatus,
  SellerStatus,
  StoreStatus,
} from '@prisma/client';

import { CartStockService } from './cart-stock.service';
import { CartValidationService } from './cart-validation.service';

describe('CartValidationService', () => {
  const prisma = {
    productVariant: {
      findUnique: jest.fn(),
    },
  };

  let service: CartValidationService;

  const validVariant = {
    id: 'variant-1',
    currencyId: 'currency-1',
    status: ProductVariantStatus.ACTIVE,
    deletedAt: null,
    inventoryItems: [
      { quantityAvailable: 3 },
      { quantityAvailable: 4 },
    ],
    currency: { id: 'currency-1' },
    product: {
      status: ProductStatus.APPROVED,
      deletedAt: null,
      store: {
        status: StoreStatus.ACTIVE,
        deletedAt: null,
        seller: {
          status: SellerStatus.VERIFIED,
          deletedAt: null,
        },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CartValidationService(prisma as never, new CartStockService());
  });

  it('deve validar uma variante comercialmente disponível', async () => {
    prisma.productVariant.findUnique.mockResolvedValue(validVariant);

    const result = await service.validateVariantForCart({
      variantId: 'variant-1',
      quantity: 5,
      cartCurrencyId: 'currency-1',
    });

    expect(result.availableQuantity).toBe(7);
    expect(result.variant.id).toBe('variant-1');
  });

  it('deve rejeitar quantidade maior que o estoque disponível', async () => {
    prisma.productVariant.findUnique.mockResolvedValue(validVariant);

    await expect(
      service.validateVariantForCart({
        variantId: 'variant-1',
        quantity: 8,
        cartCurrencyId: 'currency-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deve rejeitar moeda incompatível com o carrinho', async () => {
    prisma.productVariant.findUnique.mockResolvedValue(validVariant);

    await expect(
      service.validateVariantForCart({
        variantId: 'variant-1',
        quantity: 1,
        cartCurrencyId: 'currency-2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deve rejeitar loja suspensa', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      ...validVariant,
      product: {
        ...validVariant.product,
        store: {
          ...validVariant.product.store,
          status: StoreStatus.SUSPENDED,
        },
      },
    });

    await expect(
      service.validateVariantForCart({
        variantId: 'variant-1',
        quantity: 1,
        cartCurrencyId: 'currency-1',
      }),
    ).rejects.toThrow('A loja está indisponível para vendas.');
  });

  it('deve rejeitar vendedor sem verificação aprovada', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      ...validVariant,
      product: {
        ...validVariant.product,
        store: {
          ...validVariant.product.store,
          seller: {
            ...validVariant.product.store.seller,
            status: SellerStatus.SUSPENDED,
          },
        },
      },
    });

    await expect(
      service.validateVariantForCart({
        variantId: 'variant-1',
        quantity: 1,
        cartCurrencyId: 'currency-1',
      }),
    ).rejects.toThrow('O vendedor não está autorizado a realizar vendas.');
  });
});
