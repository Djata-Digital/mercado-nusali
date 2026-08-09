import { Prisma } from '@prisma/client';

import { CouponService } from '../../coupons/coupon.service';
import { ShippingCalculationService } from '../shipping/shipping-calculation.service';
import { CheckoutPreviewService } from './checkout-preview.service';

describe('CheckoutPreviewService', () => {
  const couponService = {
    validateCoupon: jest.fn(),
  } as unknown as CouponService;

  const shippingService = {
    calculateShippingOptions: jest.fn(),
  } as unknown as ShippingCalculationService;

  let service: CheckoutPreviewService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckoutPreviewService(couponService, shippingService);
    (shippingService.calculateShippingOptions as jest.Mock).mockResolvedValue([
      {
        providerCode: 'INTERNAL',
        serviceCode: 'STANDARD',
        serviceName: 'Padrão',
        cost: 20,
        estimatedMinDays: 2,
        estimatedMaxDays: 5,
        status: 'CALCULATED',
      },
    ]);
  });

  const cart = {
    id: 'cart-1',
    currencyId: 'brl',
    items: [
      {
        id: 'item-1',
        productId: 'product-1',
        storeId: 'store-1',
        quantity: 2,
        unitPriceSnapshot: new Prisma.Decimal('50'),
      },
    ],
    stores: [
      {
        store: { id: 'store-1', countryId: 'BR' },
        subtotal: new Prisma.Decimal('100'),
        weightKg: new Prisma.Decimal('2'),
        volumeM3: new Prisma.Decimal('0.01'),
      },
    ],
    summary: {
      subtotal: new Prisma.Decimal('100'),
      totalWeightKg: new Prisma.Decimal('2'),
      totalVolumeM3: new Prisma.Decimal('0.01'),
    },
  };

  it('deve montar snapshots com Decimal serializado como string', async () => {
    const result = await service.build({
      userId: 'user-1',
      cart,
      address: { id: 'address-1', countryId: 'BR' },
    });

    expect(result.pricingSnapshot).toEqual(
      expect.objectContaining({
        subtotal: '100',
        estimatedTaxAmount: '0',
      }),
    );
    expect(result.itemsSnapshot[0].unitPriceSnapshot).toBe('50');
  });

  it('deve validar cupom e calcular cotação por loja', async () => {
    (couponService.validateCoupon as jest.Mock).mockResolvedValue({
      coupon: { id: 'coupon-1', code: 'TESTE' },
      discountAmount: 10,
      isFreeShipping: false,
    });

    const result = await service.build({
      userId: 'user-1',
      cart,
      address: { id: 'address-1', countryId: 'BR' },
      couponCode: 'TESTE',
    });

    expect(couponService.validateCoupon).toHaveBeenCalled();
    expect(shippingService.calculateShippingOptions).toHaveBeenCalledTimes(1);
    expect(result.discount.toString()).toBe('10');
    expect(result.shippingQuotes['store-1']).toHaveLength(1);
  });

  it('deve gerar hash determinístico para o mesmo conteúdo', async () => {
    const first = await service.build({
      userId: 'user-1',
      cart,
      address: { id: 'address-1', countryId: 'BR' },
    });
    const second = await service.build({
      userId: 'user-1',
      cart,
      address: { id: 'address-1', countryId: 'BR' },
    });

    expect(first.payloadHash).toBe(second.payloadHash);
  });
});
