import { Injectable } from '@nestjs/common';
import { ICarrierProvider } from './carrier-provider.interface';
import { NusaliInternalCarrierProvider } from './nusali-internal-carrier.provider';
import { GenericLocalCarrierProvider } from './generic-local-carrier.provider';
import {
  DhlCarrierProvider,
  UpsCarrierProvider,
  FedexCarrierProvider,
  PostalCarrierProvider,
} from './external-unconfigured.providers';

@Injectable()
export class CarrierProviderFactory {
  private readonly providersMap: Map<string, ICarrierProvider> = new Map();

  constructor(
    private readonly nusaliProvider: NusaliInternalCarrierProvider,
    private readonly localProvider: GenericLocalCarrierProvider,
    private readonly dhlProvider: DhlCarrierProvider,
    private readonly upsProvider: UpsCarrierProvider,
    private readonly fedexProvider: FedexCarrierProvider,
    private readonly postalProvider: PostalCarrierProvider,
  ) {
    this.registerProvider('INTERNAL', nusaliProvider);
    this.registerProvider('NUSALI_LOGISTICS', nusaliProvider);
    this.registerProvider('GENERIC', localProvider);
    this.registerProvider('LOCAL_PARTNER', localProvider);
    this.registerProvider('DHL', dhlProvider);
    this.registerProvider('UPS', upsProvider);
    this.registerProvider('FEDEX', fedexProvider);
    this.registerProvider('POSTAL', postalProvider);
    this.registerProvider('CORREIOS', postalProvider);

    const providers = [nusaliProvider, localProvider, dhlProvider, upsProvider, fedexProvider, postalProvider];
    for (const p of providers) {
      if (p && p.carrierCode) {
        this.registerProvider(p.carrierCode, p);
      }
    }
  }

  private registerProvider(key: string, provider: ICarrierProvider) {
    if (provider && key) {
      this.providersMap.set(key.toUpperCase(), provider);
    }
  }

  /**
   * Resolve o provedor técnico logístico com base no providerType explícito (ou código comercial).
   */
  getProvider(providerTypeOrCode?: string): ICarrierProvider {
    const key = (providerTypeOrCode || 'INTERNAL').toUpperCase();
    const provider = this.providersMap.get(key);

    if (!provider) {
      if (key.includes('LOCAL') || key.includes('GENERIC')) return this.localProvider;
      return this.nusaliProvider;
    }

    return provider;
  }
}
