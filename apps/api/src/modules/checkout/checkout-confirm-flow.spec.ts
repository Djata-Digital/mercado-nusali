import { CheckoutService } from './checkout.service';

describe('CheckoutService - confirmação', () => {
  const confirmationService = { confirm: jest.fn() };
  const service = new CheckoutService(
    {} as any,
    {} as any,
    confirmationService as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('deve delegar a confirmação ao serviço transacional especializado', async () => {
    confirmationService.confirm.mockResolvedValue({ orderGroup: { id: 'og-1' } });

    await expect(
      service.confirmCheckout('user-1', {
        checkoutSessionId: 'session-1',
        shippingSelections: [
          { storeId: 'store-1', serviceCode: 'STANDARD' },
        ],
      }),
    ).resolves.toEqual({ orderGroup: { id: 'og-1' } });

    expect(confirmationService.confirm).toHaveBeenCalledWith('user-1', {
      checkoutSessionId: 'session-1',
      shippingSelections: [
        { storeId: 'store-1', serviceCode: 'STANDARD' },
      ],
    });
  });

  it('deve manter o alias confirm compatível com sessionId em string', async () => {
    confirmationService.confirm.mockResolvedValue({ ok: true });

    await service.confirm('user-1', 'session-1');

    expect(confirmationService.confirm).toHaveBeenCalledWith('user-1', {
      checkoutSessionId: 'session-1',
    });
  });
});
