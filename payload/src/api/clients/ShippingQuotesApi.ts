import { apiClient, ApiResponse } from '../apiClient';

export interface ShippingQuoteOption {
  serviceCode: string;
  name: string;
  amount: string;
  currency: string;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  provider: 'DB_RULE' | 'DIGITAL_DELIVERY';
}

export interface ShippingQuoteStore {
  storeId: string;
  storeName: string;
  options: ShippingQuoteOption[];
}

export interface ShippingQuoteResult {
  addressId: string;
  destinationCountry: string;
  currency: string;
  stores: ShippingQuoteStore[];
}

export class ShippingQuotesApi {
  static calculate(addressId: string): Promise<ApiResponse<ShippingQuoteResult>> {
    return apiClient.post('/checkout/shipping-quotes', { addressId });
  }
}
