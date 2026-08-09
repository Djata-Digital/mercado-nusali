import { Injectable } from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentProviderIntegrationMode,
  PaymentProviderResult,
} from './payment-provider.interface';
import { PaymentMethodType, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class WalletProvider implements IPaymentProvider {
  readonly providerName = PaymentProvider.NUSALI;
  readonly integrationMode = PaymentProviderIntegrationMode.INTERNAL;
  readonly supportedMethods = [PaymentMethodType.NUSALI_WALLET] as const;

  async createPayment(
    paymentId: string,
    amount: Prisma.Decimal,
    currencyCode: string,
    method: PaymentMethodType,
    metadata?: any,
  ): Promise<PaymentProviderResult> {
    const txId = `WLT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    return {
      success: true,
      status: PaymentStatus.CAPTURED,
      providerReference: `WLT-REF-${paymentId.slice(0, 8)}`,
      providerTransactionId: txId,
      metadata: {
        walletTransfer: true,
        provider: 'NUSALI_WALLET',
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
      providerTransactionId: `WLT-REFUND-${crypto.randomBytes(4).toString('hex')}`,
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
