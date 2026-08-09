import { PaymentMethodType, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';

/**
 * Identifica se o adapter representa infraestrutura interna do Nusali,
 * uma simulação determinística de desenvolvimento ou uma integração externa real.
 *
 * Nesta sprint nenhum provider externo real é ativado. ORANGE, MTN, PIX e CARD
 * continuam explicitamente SIMULATED até que credenciais e contratos reais sejam
 * configurados em sprints futuras.
 */
export enum PaymentProviderIntegrationMode {
  INTERNAL = 'INTERNAL',
  SIMULATED = 'SIMULATED',
  EXTERNAL = 'EXTERNAL',
}


export interface RefundProviderContext {
  refundId: string;
  idempotencyKey: string;
}

export interface PaymentProviderResult {
  success: boolean;
  status: PaymentStatus;
  providerReference?: string;
  providerTransactionId?: string;
  errorMessage?: string;
  metadata?: unknown;
}

export interface IPaymentProvider {
  readonly providerName: PaymentProvider;
  readonly integrationMode: PaymentProviderIntegrationMode;
  readonly supportedMethods: readonly PaymentMethodType[];

  createPayment(
    paymentId: string,
    amount: Prisma.Decimal,
    currencyCode: string,
    method: PaymentMethodType,
    metadata?: unknown,
  ): Promise<PaymentProviderResult>;

  cancelPayment(
    paymentId: string,
    providerTransactionId?: string,
  ): Promise<PaymentProviderResult>;

  capturePayment(
    paymentId: string,
    providerTransactionId?: string,
  ): Promise<PaymentProviderResult>;

  refundPayment(
    paymentId: string,
    providerTransactionId: string,
    amount: Prisma.Decimal,
    context?: RefundProviderContext,
  ): Promise<PaymentProviderResult>;

  queryPayment(
    paymentId: string,
    providerTransactionId?: string,
  ): Promise<PaymentProviderResult>;

  validateWebhook(
    headers: Record<string, unknown>,
    payload: unknown,
    signature?: string,
  ): Promise<boolean>;
}
