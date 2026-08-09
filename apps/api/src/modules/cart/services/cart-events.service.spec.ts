import { CART_EVENT_TYPES, CartEventsService } from './cart-events.service';

describe('CartEventsService', () => {
  const outboxEventCreate = jest.fn();
  const tx = {
    outboxEvent: {
      create: outboxEventCreate,
    },
  } as any;

  let service: CartEventsService;

  beforeEach(() => {
    jest.clearAllMocks();
    outboxEventCreate.mockResolvedValue({ id: 'event-1' });
    service = new CartEventsService();
  });

  it('deve registrar criação e recálculo do carrinho na mesma transação', async () => {
    await service.recordCartCreated(tx, {
      cartId: 'cart-1',
      userId: 'user-1',
      currencyId: 'currency-1',
    });

    expect(outboxEventCreate).toHaveBeenCalledTimes(2);
    expect(outboxEventCreate).toHaveBeenNthCalledWith(1, {
      data: {
        aggregateType: 'Cart',
        aggregateId: 'cart-1',
        eventType: CART_EVENT_TYPES.CREATED,
        payloadJson: {
          eventVersion: 1,
          cartId: 'cart-1',
          userId: 'user-1',
          currencyId: 'currency-1',
        },
      },
    });
    expect(outboxEventCreate).toHaveBeenNthCalledWith(2, {
      data: {
        aggregateType: 'Cart',
        aggregateId: 'cart-1',
        eventType: CART_EVENT_TYPES.RECALCULATED,
        payloadJson: {
          eventVersion: 1,
          cartId: 'cart-1',
          userId: 'user-1',
          reason: 'CART_CREATED',
        },
      },
    });
  });

  it('deve padronizar o payload do item adicionado', async () => {
    await service.recordItemAdded(tx, {
      cartId: 'cart-1',
      userId: 'user-1',
      itemId: 'item-1',
      variantId: 'variant-1',
      quantityAdded: 2,
      resultingQuantity: 5,
    });

    expect(outboxEventCreate).toHaveBeenCalledTimes(2);
    expect(outboxEventCreate).toHaveBeenNthCalledWith(1, {
      data: {
        aggregateType: 'Cart',
        aggregateId: 'cart-1',
        eventType: CART_EVENT_TYPES.ITEM_ADDED,
        payloadJson: {
          eventVersion: 1,
          cartId: 'cart-1',
          userId: 'user-1',
          itemId: 'item-1',
          variantId: 'variant-1',
          quantityAdded: 2,
          resultingQuantity: 5,
        },
      },
    });
  });

  it('deve registrar quantidade anterior e atual ao atualizar item', async () => {
    await service.recordItemUpdated(tx, {
      cartId: 'cart-1',
      userId: 'user-1',
      itemId: 'item-1',
      variantId: 'variant-1',
      previousQuantity: 1,
      currentQuantity: 3,
    });

    expect(outboxEventCreate).toHaveBeenNthCalledWith(1, {
      data: {
        aggregateType: 'Cart',
        aggregateId: 'cart-1',
        eventType: CART_EVENT_TYPES.ITEM_UPDATED,
        payloadJson: {
          eventVersion: 1,
          cartId: 'cart-1',
          userId: 'user-1',
          itemId: 'item-1',
          variantId: 'variant-1',
          previousQuantity: 1,
          currentQuantity: 3,
        },
      },
    });
  });

  it('deve registrar remoção e limpeza sem EventEmitter', async () => {
    await service.recordItemRemoved(tx, {
      cartId: 'cart-1',
      userId: 'user-1',
      itemId: 'item-1',
      variantId: 'variant-1',
      removedQuantity: 4,
    });

    await service.recordCartCleared(tx, {
      cartId: 'cart-1',
      userId: 'user-1',
      removedItemsCount: 3,
    });

    expect(outboxEventCreate).toHaveBeenCalledTimes(4);
    expect(outboxEventCreate.mock.calls[0][0].data.eventType).toBe(
      CART_EVENT_TYPES.ITEM_REMOVED,
    );
    expect(outboxEventCreate.mock.calls[2][0].data.eventType).toBe(
      CART_EVENT_TYPES.CLEARED,
    );
  });
});
