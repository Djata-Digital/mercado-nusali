import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethodType, PaymentProvider } from '@prisma/client';
import { CardProvider } from './card.provider';
import { MTNMoneyProvider } from './mtn-money.provider';
import { OrangeMoneyProvider } from './orange-money.provider';
import {
  IPaymentProvider,
  PaymentProviderIntegrationMode,
} from './payment-provider.interface';
import { PixProvider } from './pix.provider';
import { WalletProvider } from './wallet.provider';

export interface ResolvedPaymentProvider {
  providerType: PaymentProvider;
  provider: IPaymentProvider;
}

/**
 * PaymentProviderFactory
 *
 * Único ponto de resolução técnica dos adapters de pagamento.
 *
 * Regras:
 * - PaymentsService não conhece implementações concretas de providers;
 * - cada método possui um provider explícito e verificável;
 * - BANK_TRANSFER permanece não configurado em vez de cair silenciosamente
 *   em outro adapter;
 * - providers simulados continuam identificados como SIMULATED, evitando
 *   confundi-los com integrações externas reais em produção.
 */
@Injectable()
export class PaymentProviderFactory {
  private readonly providers: ReadonlyMap<PaymentProvider, IPaymentProvider>;
  private readonly methodToProvider: ReadonlyMap<PaymentMethodType, PaymentProvider>;

  constructor(
    orangeMoneyProvider: OrangeMoneyProvider,
    mtnMoneyProvider: MTNMoneyProvider,
    pixProvider: PixProvider,
    cardProvider: CardProvider,
    walletProvider: WalletProvider,
  ) {
    const registeredProviders: IPaymentProvider[] = [
      orangeMoneyProvider,
      mtnMoneyProvider,
      pixProvider,
      cardProvider,
      walletProvider,
    ];

    this.providers = new Map(
      registeredProviders.map((provider) => [provider.providerName, provider]),
    );

    this.methodToProvider = new Map<PaymentMethodType, PaymentProvider>([
      [PaymentMethodType.ORANGE_MONEY, PaymentProvider.ORANGE],
      [PaymentMethodType.MTN_MONEY, PaymentProvider.MTN],
      [PaymentMethodType.PIX, PaymentProvider.PIX_INTERNAL],
      [PaymentMethodType.CARD, PaymentProvider.CARD_INTERNAL],
      [PaymentMethodType.NUSALI_WALLET, PaymentProvider.NUSALI],
    ]);

    this.assertRegistryIntegrity(registeredProviders);
  }

  resolveByMethod(method: PaymentMethodType): ResolvedPaymentProvider {
    const providerType = this.methodToProvider.get(method);
    if (!providerType) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Método de pagamento ainda não possui provider configurado: ${method}.`,
        errorCode: 'PAYMENT_METHOD_NOT_CONFIGURED',
      });
    }

    const provider = this.getByType(providerType);
    if (!provider.supportedMethods.includes(method)) {
      throw new BadRequestException({
        statusCode: 400,
        message: `O provider ${providerType} não suporta o método ${method}.`,
        errorCode: 'PAYMENT_PROVIDER_METHOD_MISMATCH',
      });
    }

    return { providerType, provider };
  }

  getByType(providerType: PaymentProvider): IPaymentProvider {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Provedor de pagamento não suportado: ${providerType}.`,
        errorCode: 'PAYMENT_PROVIDER_NOT_SUPPORTED',
      });
    }
    return provider;
  }

  /**
   * Permite que endpoints administrativos ou health checks descrevam a
   * infraestrutura sem expor segredos ou instâncias concretas dos adapters.
   */
  listCapabilities() {
    return [...this.providers.values()].map((provider) => ({
      provider: provider.providerName,
      integrationMode: provider.integrationMode,
      simulated:
        provider.integrationMode === PaymentProviderIntegrationMode.SIMULATED,
      supportedMethods: [...provider.supportedMethods],
    }));
  }

  private assertRegistryIntegrity(providers: IPaymentProvider[]): void {
    const names = new Set<PaymentProvider>();

    for (const provider of providers) {
      if (names.has(provider.providerName)) {
        throw new Error(
          `PaymentProvider duplicado no registry: ${provider.providerName}.`,
        );
      }
      names.add(provider.providerName);

      if (provider.supportedMethods.length === 0) {
        throw new Error(
          `PaymentProvider ${provider.providerName} precisa declarar ao menos um método suportado.`,
        );
      }
    }
  }
}
