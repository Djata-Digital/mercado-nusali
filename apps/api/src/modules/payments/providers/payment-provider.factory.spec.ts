import { BadRequestException } from '@nestjs/common';
import { PaymentMethodType, PaymentProvider } from '@prisma/client';
import { CardProvider } from './card.provider';
import { MTNMoneyProvider } from './mtn-money.provider';
import { OrangeMoneyProvider } from './orange-money.provider';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymentProviderIntegrationMode } from './payment-provider.interface';
import { PixProvider } from './pix.provider';
import { WalletProvider } from './wallet.provider';

describe('PaymentProviderFactory', () => {
  let factory: PaymentProviderFactory;

  beforeEach(() => {
    factory = new PaymentProviderFactory(
      new OrangeMoneyProvider(),
      new MTNMoneyProvider(),
      new PixProvider(),
      new CardProvider(),
      new WalletProvider(),
    );
  });

  const resolutionCases: Array<[PaymentMethodType, PaymentProvider]> = [
    [PaymentMethodType.ORANGE_MONEY, PaymentProvider.ORANGE],
    [PaymentMethodType.MTN_MONEY, PaymentProvider.MTN],
    [PaymentMethodType.PIX, PaymentProvider.PIX_INTERNAL],
    [PaymentMethodType.CARD, PaymentProvider.CARD_INTERNAL],
    [PaymentMethodType.NUSALI_WALLET, PaymentProvider.NUSALI],
  ];

  it.each(resolutionCases)('deve resolver %s para %s', (method, expectedProvider) => {
    const resolved = factory.resolveByMethod(method);
    expect(resolved.providerType).toBe(expectedProvider);
    expect(resolved.provider.providerName).toBe(expectedProvider);
  });

  it('deve rejeitar BANK_TRANSFER sem fallback silencioso', () => {
    expect(() => factory.resolveByMethod(PaymentMethodType.BANK_TRANSFER)).toThrow(
      BadRequestException,
    );
  });

  it('deve identificar integrações externas ainda simuladas', () => {
    const capabilities = factory.listCapabilities();
    const orange = capabilities.find(
      (item) => item.provider === PaymentProvider.ORANGE,
    );
    const wallet = capabilities.find(
      (item) => item.provider === PaymentProvider.NUSALI,
    );

    expect(orange?.integrationMode).toBe(
      PaymentProviderIntegrationMode.SIMULATED,
    );
    expect(orange?.simulated).toBe(true);
    expect(wallet?.integrationMode).toBe(
      PaymentProviderIntegrationMode.INTERNAL,
    );
    expect(wallet?.simulated).toBe(false);
  });

  it('deve obter provider diretamente pelo tipo persistido no Payment', () => {
    expect(factory.getByType(PaymentProvider.PIX_INTERNAL)).toBeInstanceOf(
      PixProvider,
    );
  });
});
