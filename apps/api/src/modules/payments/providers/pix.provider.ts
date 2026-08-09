import { Injectable } from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentProviderIntegrationMode,
  PaymentProviderResult,
} from './payment-provider.interface';
import { PaymentMethodType, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PixProvider implements IPaymentProvider {
  readonly providerName = PaymentProvider.PIX_INTERNAL;
  readonly integrationMode = PaymentProviderIntegrationMode.SIMULATED;
  readonly supportedMethods = [PaymentMethodType.PIX] as const;

  async createPayment(
    paymentId: string,
    amount: Prisma.Decimal,
    currencyCode: string,
    method: PaymentMethodType,
    metadata?: any,
  ): Promise<PaymentProviderResult> {
    const txId = `PIX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const qrCodeCopyPaste = `00020126580014BR.GOV.BCB.PIX0136${txId}5204000053039865405${amount}5802BR5914MERCADO_NUSALI6006BISSAU62070503***6304`;

    return {
      success: true,
      status: PaymentStatus.PENDING,
      providerReference: `PIX-REF-${paymentId.slice(0, 8)}`,
      providerTransactionId: txId,
      metadata: {
        qrCodeCopyPaste,
        qrCodeBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        expiresInSeconds: 3600,
        provider: 'PIX_INTERNAL',
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
      providerTransactionId: `PIX-REFUND-${crypto.randomBytes(4).toString('hex')}`,
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
