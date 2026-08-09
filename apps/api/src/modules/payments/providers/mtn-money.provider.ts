import { Injectable } from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentProviderIntegrationMode,
  PaymentProviderResult,
} from './payment-provider.interface';
import { PaymentMethodType, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class MTNMoneyProvider implements IPaymentProvider {
  readonly providerName = PaymentProvider.MTN;
  readonly integrationMode = PaymentProviderIntegrationMode.SIMULATED;
  readonly supportedMethods = [PaymentMethodType.MTN_MONEY] as const;

  async createPayment(
    paymentId: string,
    amount: Prisma.Decimal,
    currencyCode: string,
    method: PaymentMethodType,
    metadata?: any,
  ): Promise<PaymentProviderResult> {
    const txId = `MTN-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const ref = `MTN-REF-${paymentId.slice(0, 8)}`;

    return {
      success: true,
      status: PaymentStatus.PENDING,
      providerReference: ref,
      providerTransactionId: txId,
      metadata: {
        paymentUrl: `https://api.mtn.com/momo/pay/${txId}`,
        ussdPrompt: `*165*3*${amount}#`,
        provider: 'MTN_MONEY',
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
      providerTransactionId: `MTN-REFUND-${crypto.randomBytes(4).toString('hex')}`,
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
