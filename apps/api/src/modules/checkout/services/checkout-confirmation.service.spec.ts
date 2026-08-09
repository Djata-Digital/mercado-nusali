import { BadRequestException, ConflictException } from '@nestjs/common';
import { CartStatus, CheckoutSessionStatus, Prisma } from '@prisma/client';

import { CheckoutConfirmationService } from './checkout-confirmation.service';

describe('CheckoutConfirmationService', () => {
  const cartSummaryService = { buildSummary: jest.fn() };
  const checkoutEventsService = {
    recordCheckoutExpired: jest.fn(),
    recordCheckoutCompleted: jest.fn(),
    recordReservationCreated: jest.fn(),
    recordOrderCreated: jest.fn(),
  };
  const checkoutPreviewService = {
    createConfirmationPayloadHash: jest.fn(),
  };
  const shippingSelectionService = { resolve: jest.fn() };
  const tx: any = {
    checkoutSession: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const checkoutTransactionService = {
    run: jest.fn((operation: (client: any) => Promise<unknown>) => operation(tx)),
  };

  const service = new CheckoutConfirmationService(
    cartSummaryService as any,
    checkoutEventsService as any,
    checkoutPreviewService as any,
    shippingSelectionService as any,
    checkoutTransactionService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    checkoutTransactionService.run.mockImplementation(
      (operation: (client: any) => Promise<unknown>) => operation(tx),
    );
  });

  it('deve marcar sessão expirada e gravar evento no mesmo tx', async () => {
    tx.checkoutSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      cartId: 'cart-1',
      status: CheckoutSessionStatus.CREATED,
      expiresAt: new Date(Date.now() - 1_000),
    });
    tx.checkoutSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.confirm('user-1', { checkoutSessionId: 'session-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.checkoutSession.updateMany).toHaveBeenCalled();
    expect(checkoutEventsService.recordCheckoutExpired).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ checkoutSessionId: 'session-1' }),
    );
  });

  it('deve retornar resultado existente quando a sessão já foi confirmada', async () => {
    const existing = {
      id: 'group-1',
      orders: [{ id: 'order-1' }],
      stockReservations: [{ id: 'reservation-1' }],
    };
    tx.checkoutSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: CheckoutSessionStatus.CONFIRMED,
      orderGroups: [existing],
    });

    await expect(
      service.confirm('user-1', { checkoutSessionId: 'session-1' }),
    ).resolves.toEqual({
      orderGroup: existing,
      orders: existing.orders,
      stockReservation: existing.stockReservations[0],
    });
  });

  it('deve rejeitar quando o payload comercial mudou', async () => {
    tx.checkoutSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      addressId: 'address-1',
      currencyId: 'currency-1',
      payloadHash: 'old-hash',
      pricingSnapshotJson: { discountAmount: '0' },
      shippingQuotesJson: {},
      status: CheckoutSessionStatus.CREATED,
      expiresAt: new Date(Date.now() + 60_000),
      cart: {
        id: 'cart-1',
        status: CartStatus.ACTIVE,
        items: [],
      },
    });

    // Permite alcançar a comparação do hash sem executar criação de pedidos.
    tx.checkoutSession.findUnique.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      addressId: 'address-1',
      currencyId: 'currency-1',
      payloadHash: 'old-hash',
      pricingSnapshotJson: { discountAmount: '0' },
      shippingQuotesJson: {},
      status: CheckoutSessionStatus.CREATED,
      expiresAt: new Date(Date.now() + 60_000),
      cart: {
        id: 'cart-1',
        status: CartStatus.ACTIVE,
        items: [
          {
            id: 'item-1',
            quantity: 1,
            product: {
              title: 'Produto',
              status: 'APPROVED',
              deletedAt: null,
              store: {
                id: 'store-1',
                name: 'Loja',
                status: 'ACTIVE',
                deletedAt: null,
                seller: { status: 'VERIFIED', deletedAt: null },
              },
            },
            variant: {
              sku: 'SKU',
              status: 'ACTIVE',
              deletedAt: null,
              currencyId: 'currency-1',
              inventoryItems: [
                {
                  quantityAvailable: 1,
                  warehouse: { status: 'ACTIVE' },
                },
              ],
            },
          },
        ],
      },
    });
    cartSummaryService.buildSummary.mockReturnValue({
      id: 'cart-1',
      items: [],
      summary: { subtotal: new Prisma.Decimal(10) },
    });
    checkoutPreviewService.createConfirmationPayloadHash.mockReturnValue(
      'new-hash',
    );

    await expect(
      service.confirm('user-1', { checkoutSessionId: 'session-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
