import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CartService } from '../cart/cart.service';
import { CheckoutService } from './checkout.service';
import { CheckoutEventsService } from './services/checkout-events.service';
import { CheckoutPreviewService } from './services/checkout-preview.service';
import { CheckoutTransactionService } from './services/checkout-transaction.service';
import { CheckoutValidationService } from './services/checkout-validation.service';

describe('CheckoutService - criação de sessão', () => {
  const tx = {
    checkoutSession: {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
    },
  } as unknown as Prisma.TransactionClient;

  const validation = {
    validateCheckout: jest.fn(),
  } as unknown as CheckoutValidationService;
  const cartService = {
    getOrCreateCart: jest.fn(),
  } as unknown as CartService;
  const confirmation = {
    confirm: jest.fn(),
  };
  const events = {
    recordCheckoutStarted: jest.fn(),
  } as unknown as CheckoutEventsService;
  const preview = {
    build: jest.fn(),
  } as unknown as CheckoutPreviewService;
  const transaction = {
    run: jest.fn((callback) => callback(tx)),
  } as unknown as CheckoutTransactionService;

  let service: CheckoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckoutService(
      validation,
      cartService,
      confirmation as any,
      events,
      preview,
      transaction,
    );

    (cartService.getOrCreateCart as jest.Mock).mockResolvedValue({
      id: 'cart-1',
      currencyId: 'brl',
      items: [{ id: 'item-1' }],
      stores: [],
      summary: { subtotal: new Prisma.Decimal('100') },
    });
    (validation.validateCheckout as jest.Mock).mockResolvedValue({
      address: { id: 'address-1', countryId: 'BR' },
    });
    (preview.build as jest.Mock).mockResolvedValue({
      couponData: null,
      shippingQuotes: {},
      estimatedTax: new Prisma.Decimal('5'),
      discount: new Prisma.Decimal('0'),
      expiresAt: new Date('2026-08-07T12:00:00.000Z'),
      payloadHash: 'hash-1',
      itemsSnapshot: [],
      pricingSnapshot: { subtotal: '100' },
      estimatedTaxesSnapshot: { amount: '5' },
      couponSnapshot: undefined,
    });
  });

  it('deve criar sessão e evento usando o mesmo TransactionClient', async () => {
    await service.createCheckoutSession('user-1', {
      addressId: 'address-1',
    });

    expect(transaction.run).toHaveBeenCalledTimes(1);
    expect(tx.checkoutSession.create).toHaveBeenCalled();
    expect(events.recordCheckoutStarted).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        cartId: 'cart-1',
        checkoutSessionId: 'session-1',
      }),
    );
  });

  it('deve propagar falha da Outbox para permitir rollback', async () => {
    (events.recordCheckoutStarted as jest.Mock).mockRejectedValueOnce(
      new Error('outbox indisponível'),
    );

    await expect(
      service.createCheckoutSession('user-1', { addressId: 'address-1' }),
    ).rejects.toThrow('outbox indisponível');
  });

  it('deve rejeitar carrinho vazio antes de criar preview', async () => {
    (cartService.getOrCreateCart as jest.Mock).mockResolvedValueOnce({
      id: 'cart-1',
      items: [],
    });

    await expect(
      service.createCheckoutSession('user-1', { addressId: 'address-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(preview.build).not.toHaveBeenCalled();
    expect(transaction.run).not.toHaveBeenCalled();
  });
});
