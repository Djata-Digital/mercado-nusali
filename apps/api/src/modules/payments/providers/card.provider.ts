import { Injectable } from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentProviderIntegrationMode,
  PaymentProviderResult,
} from './payment-provider.interface';
import { PaymentMethodType, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class CardProvider implements IPaymentProvider {
  readonly providerName = PaymentProvider.CARD_INTERNAL;
  readonly integrationMode = PaymentProviderIntegrationMode.SIMULATED;
  readonly supportedMethods = [PaymentMethodType.CARD] as const;

  async createPayment(
    paymentId: string,
    amount: Prisma.Decimal,
    currencyCode: string,
    method: PaymentMethodType,
    metadata?: any,
  ): Promise<PaymentProviderResult> {
    const txId = `CARD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    return {
      success: true,
      status: PaymentStatus.AUTHORIZED,
      providerReference: `CARD-REF-${paymentId.slice(0, 8)}`,
      providerTransactionId: txId,
      metadata: {
        authorizationCode: `AUTH-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        cardBrand: metadata?.cardBrand || 'VISA',
        last4Digits: metadata?.last4Digits || '4242',
        provider: 'CARD_INTERNAL',
      },
    };
  }

  async cancelPayment(paymentId: string, providerTransactionId?: string): Promise<PaymentProviderResult> {
    return {
      success: true,
      status: PaymentStatus.CANCELLED,
      providerTransactionId,
    };
  }

  async capturePayment(paymentId: string, providerTransactionId?: string): Promise<PaymentProviderResult> {
    return {
      success: true,
      status: PaymentStatus.CAPTURED,
      providerTransactionId,
    };
  }

  async refundPayment(
    paymentId: string,
    providerTransactionId: string,
    amount: Prisma.Decimal,
  ): Promise<PaymentProviderResult> {
    return {
      success: true,
      status: PaymentStatus.REFUNDED,
      providerTransactionId: `CARD-REFUND-${crypto.randomBytes(4).toString('hex')}`,
    };
  }

  async queryPayment(paymentId: string, providerTransactionId?: string): Promise<PaymentProviderResult> {
    return {
      success: true,
      status: PaymentStatus.CAPTURED,
      providerTransactionId,
    };
  }

  async validateWebhook(headers: any, payload: any, signature?: string): Promise<boolean> {
    return true;
  }
}
