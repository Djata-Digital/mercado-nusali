import { PaymentMethodType, PaymentProvider } from '@prisma/client';
import { CardProvider } from './card.provider';
import { MTNMoneyProvider } from './mtn-money.provider';
import { OrangeMoneyProvider } from './orange-money.provider';
import { PaymentProviderIntegrationMode } from './payment-provider.interface';
import { PixProvider } from './pix.provider';
import { WalletProvider } from './wallet.provider';

describe('Payment Providers - contrato Sprint 7.1.4', () => {
  const providers = [
    new OrangeMoneyProvider(),
    new MTNMoneyProvider(),
    new PixProvider(),
    new CardProvider(),
    new WalletProvider(),
  ];

  it('deve possuir providerName único para cada adapter', () => {
    const names = providers.map((provider) => provider.providerName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('deve declarar explicitamente todos os métodos suportados', () => {
    expect(
      providers.find((p) => p.providerName === PaymentProvider.ORANGE)
        ?.supportedMethods,
    ).toEqual([PaymentMethodType.ORANGE_MONEY]);
    expect(
      providers.find((p) => p.providerName === PaymentProvider.MTN)
        ?.supportedMethods,
    ).toEqual([PaymentMethodType.MTN_MONEY]);
    expect(
      providers.find((p) => p.providerName === PaymentProvider.PIX_INTERNAL)
        ?.supportedMethods,
    ).toEqual([PaymentMethodType.PIX]);
    expect(
      providers.find((p) => p.providerName === PaymentProvider.CARD_INTERNAL)
        ?.supportedMethods,
    ).toEqual([PaymentMethodType.CARD]);
    expect(
      providers.find((p) => p.providerName === PaymentProvider.NUSALI)
        ?.supportedMethods,
    ).toEqual([PaymentMethodType.NUSALI_WALLET]);
  });

  it('deve declarar providers externos atuais como simulação e wallet como interno', () => {
    for (const provider of providers) {
      if (provider.providerName === PaymentProvider.NUSALI) {
        expect(provider.integrationMode).toBe(
          PaymentProviderIntegrationMode.INTERNAL,
        );
      } else {
        expect(provider.integrationMode).toBe(
          PaymentProviderIntegrationMode.SIMULATED,
        );
      }
    }
  });
});
