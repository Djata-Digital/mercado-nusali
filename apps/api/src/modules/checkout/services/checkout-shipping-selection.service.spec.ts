import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CheckoutShippingSelectionService } from './checkout-shipping-selection.service';

describe('CheckoutShippingSelectionService', () => {
  const service = new CheckoutShippingSelectionService();
  const quotes = {
    'store-1': [
      {
        providerCode: 'INTERNAL',
        serviceCode: 'STANDARD',
        serviceName: 'Padrão',
        cost: 20,
        estimatedMinDays: 2,
        estimatedMaxDays: 5,
        status: 'CALCULATED',
      },
      {
        providerCode: 'INTERNAL',
        serviceCode: 'EXPRESS',
        serviceName: 'Expresso',
        cost: 35,
        estimatedMinDays: 1,
        estimatedMaxDays: 2,
        status: 'CALCULATED',
      },
    ],
  } as unknown as Prisma.JsonValue;

  it('deve usar o custo persistido e ignorar valores enviados pelo cliente', () => {
    const result = service.resolve({
      storeIds: ['store-1'],
      shippingQuotesJson: quotes,
      selections: {
        'store-1': { serviceCode: 'EXPRESS' },
      },
    });

    expect(result[0].cost.toString()).toBe('35');
    expect(result[0].serviceCode).toBe('EXPRESS');
  });

  it('deve aceitar o formato array usado pelo DTO HTTP', () => {
    const result = service.resolve({
      storeIds: ['store-1'],
      shippingQuotesJson: quotes,
      selections: [{ storeId: 'store-1', serviceCode: 'STANDARD' }],
    });

    expect(result[0].serviceCode).toBe('STANDARD');
  });

  it('deve exigir seleção quando houver mais de uma opção', () => {
    expect(() =>
      service.resolve({
        storeIds: ['store-1'],
        shippingQuotesJson: quotes,
      }),
    ).toThrow(BadRequestException);
  });

  it('deve selecionar automaticamente quando existir uma única opção', () => {
    const result = service.resolve({
      storeIds: ['store-2'],
      shippingQuotesJson: {
        'store-2': [
          {
            providerCode: 'LOCAL',
            serviceCode: 'ONLY',
            serviceName: 'Único',
            cost: 10,
            estimatedMinDays: 3,
            estimatedMaxDays: 4,
            status: 'CALCULATED',
          },
        ],
      } as unknown as Prisma.JsonValue,
    });

    expect(result[0].serviceCode).toBe('ONLY');
  });
});
