import { apiClient, ApiResponse } from '../apiClient';

export interface CheckoutSessionShippingOption {
  providerCode: string;
  serviceCode: string;
  serviceName: string;
  cost: string | number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  status: string;
}

export interface CheckoutSessionResult {
  session: {
    id: string;
    status: string;
    expiresAt: string;
    addressId: string;
    currency?: { code?: string };
  };
  cartSummary: any;
  stores: any[];
  shippingQuotes: Record<string, CheckoutSessionShippingOption[]>;
}

export interface CheckoutConfirmResult {
  orderGroup: {
    id: string;
    status: string;
    total: string | number;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string | number;
  }>;
  stockReservation?: {
    id: string;
    status: string;
    expiresAt: string;
  } | null;
}

export class CheckoutApi {
  static createSession(addressId: string, couponCode?: string): Promise<ApiResponse<CheckoutSessionResult>> {
    return apiClient.post('/checkout/session', {
      addressId,
      ...(couponCode ? { couponCode } : {}),
    });
  }

  static confirm(
    checkoutSessionId: string,
    shippingSelections: Array<{ storeId: string; serviceCode: string }>,
  ): Promise<ApiResponse<CheckoutConfirmResult>> {
    return apiClient.post('/checkout/confirm', {
      checkoutSessionId,
      shippingSelections,
    });
  }
}
