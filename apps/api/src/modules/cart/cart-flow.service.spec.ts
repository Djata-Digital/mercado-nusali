import { Prisma } from '@prisma/client';

import { CartService } from './cart.service';

describe('CartService - fluxo de orquestração', () => {
  const cart = {
    id: 'cart-1',
    userId: 'user-1',
    currencyId: 'currency-1',
    status: 'ACTIVE',
    items: [],
    coupon: null,
    currency: { id: 'currency-1', code: 'BRL' },
  } as any;

  const variant = {
    id: 'variant-1',
    productId: 'product-1',
    currencyId: 'currency-1',
    product: { storeId: 'store-1' },
  } as any;

  const prisma = {
    cart: { findFirst: jest.fn() },
    currency: { findFirst: jest.fn() },
  } as any;

  const tx = {
    cart: { findFirst: jest.fn(), create: jest.fn() },
    cartItem: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as any;

  const events = {
    recordCartCreated: jest.fn(),
    recordItemAdded: jest.fn(),
    recordItemUpdated: jest.fn(),
    recordItemRemoved: jest.fn(),
    recordCartCleared: jest.fn(),
  } as any;

  const pricing = {
    resolveUnitPrice: jest.fn().mockReturnValue({
      currentUnitPrice: new Prisma.Decimal('90'),
    }),
  } as any;

  const summary = {
    buildSummary: jest.fn((value) => ({ ...value, summary: {} })),
  } as any;

  const transaction = {
    run: jest.fn(async (callback) => callback(tx)),
  } as any;

  const validation = {
    validatePositiveQuantity: jest.fn(),
    validateVariantForCart: jest.fn().mockResolvedValue({
      variant,
      availableQuantity: 10,
    }),
  } as any;

  let service: CartService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CartService(
      prisma,
      events,
      pricing,
      summary,
      transaction,
      validation,
    );
  });

  it('deve criar item e evento usando o mesmo TransactionClient', async () => {
    prisma.cart.findFirst
      .mockResolvedValueOnce(cart)
      .mockResolvedValueOnce({ ...cart, items: [{ id: 'item-1' }] });
    tx.cart.findFirst.mockResolvedValue(cart);
    tx.cartItem.create.mockResolvedValue({ id: 'item-1' });

    await service.addItem('user-1', {
      variantId: 'variant-1',
      quantity: 2,
    });

    expect(validation.validateVariantForCart).toHaveBeenCalledWith(
      {
        variantId: 'variant-1',
        quantity: 2,
        cartCurrencyId: 'currency-1',
      },
      tx,
    );
    expect(tx.cartItem.create).toHaveBeenCalled();
    expect(events.recordItemAdded).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        cartId: 'cart-1',
        itemId: 'item-1',
        resultingQuantity: 2,
      }),
    );
  });

  it('deve recalcular preço ao somar quantidade de item existente', async () => {
    const cartWithItem = {
      ...cart,
      items: [
        {
          id: 'item-1',
          variantId: 'variant-1',
          quantity: 8,
        },
      ],
    };

    prisma.cart.findFirst
      .mockResolvedValueOnce(cartWithItem)
      .mockResolvedValueOnce(cartWithItem);
    tx.cart.findFirst.mockResolvedValue(cartWithItem);
    tx.cartItem.update.mockResolvedValue({ id: 'item-1' });

    await service.addItem('user-1', {
      variantId: 'variant-1',
      quantity: 2,
    });

    expect(pricing.resolveUnitPrice).toHaveBeenCalledWith(variant, 10);
    expect(tx.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        quantity: 10,
        unitPriceSnapshot: new Prisma.Decimal('90'),
        currencyId: 'currency-1',
      },
    });
  });

  it('deve propagar falha de Outbox para permitir rollback da transação', async () => {
    prisma.cart.findFirst.mockResolvedValue(cart);
    tx.cart.findFirst.mockResolvedValue(cart);
    tx.cartItem.create.mockResolvedValue({ id: 'item-1' });
    events.recordItemAdded.mockRejectedValue(new Error('outbox failure'));

    await expect(
      service.addItem('user-1', {
        variantId: 'variant-1',
        quantity: 1,
      }),
    ).rejects.toThrow('outbox failure');

    expect(transaction.run).toHaveBeenCalledTimes(1);
  });

  it('deve remover o item quando a quantidade atualizada for zero', async () => {
    const removeItem = jest.spyOn(service, 'removeItem').mockResolvedValue({
      id: 'cart-1',
    } as any);

    await service.updateItem('user-1', 'item-1', { quantity: 0 });

    expect(removeItem).toHaveBeenCalledWith('user-1', 'item-1');
  });
});
