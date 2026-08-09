import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import {
  IPaymentProvider,
  PaymentProviderIntegrationMode,
} from '../providers/payment-provider.interface';

export interface PaymentProviderInvocation<T> {
  result: T;
  durationMs: number;
  timeoutMs: number | null;
}

/**
 * Erro técnico deliberadamente simples. O PaymentsService o encaminha para
 * PaymentGatewayErrorClassifierService, que o converte em PAYMENT_TIMEOUT.
 */
export class PaymentProviderTimeoutError extends Error {
  readonly code = 'ETIMEDOUT';

  constructor(
    readonly provider: PaymentProvider,
    readonly timeoutMs: number,
  ) {
    super(
      `O provedor ${provider} excedeu o tempo limite de ${timeoutMs}ms.`,
    );
    this.name = 'PaymentProviderTimeoutError';
  }
}

/**
 * PaymentProviderTimeoutService
 *
 * Centraliza o limite máximo de espera das chamadas aos adapters financeiros.
 * Providers INTERNAL não recebem timeout externo, pois não fazem I/O com um
 * gateway remoto. Providers SIMULATED/EXTERNAL recebem timeout configurável.
 *
 * Observação: a interface atual dos providers ainda não recebe AbortSignal.
 * Portanto o timeout encerra a espera do fluxo de pagamento e limpa o timer,
 * mas não consegue cancelar fisicamente uma requisição HTTP já iniciada pelo
 * adapter. Quando adapters externos reais forem conectados, eles deverão usar
 * AbortController internamente.
 */
@Injectable()
export class PaymentProviderTimeoutService {
  private static readonly DEFAULT_TIMEOUTS_MS: Readonly<
    Record<PaymentProvider, number | null>
  > = {
    [PaymentProvider.ORANGE]: 30_000,
    [PaymentProvider.MTN]: 30_000,
    [PaymentProvider.PIX_INTERNAL]: 10_000,
    [PaymentProvider.CARD_INTERNAL]: 20_000,
    [PaymentProvider.NUSALI]: null,
  };

  async invoke<T>(
    provider: Pick<
      IPaymentProvider,
      'providerName' | 'integrationMode'
    >,
    operation: () => Promise<T>,
  ): Promise<PaymentProviderInvocation<T>> {
    const startedAt = Date.now();
    const timeoutMs = this.getTimeoutMs(
      provider.providerName,
      provider.integrationMode,
    );

    if (timeoutMs === null) {
      const result = await operation();
      return {
        result,
        durationMs: Date.now() - startedAt,
        timeoutMs: null,
      };
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const result = await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(
              new PaymentProviderTimeoutError(
                provider.providerName,
                timeoutMs,
              ),
            );
          }, timeoutMs);
        }),
      ]);

      return {
        result,
        durationMs: Date.now() - startedAt,
        timeoutMs,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Exposto para testes/health checks sem revelar credenciais.
   * INTERNAL sempre retorna null, mesmo que exista variável de ambiente.
   */
  getTimeoutMs(
    provider: PaymentProvider,
    integrationMode: PaymentProviderIntegrationMode,
  ): number | null {
    if (integrationMode === PaymentProviderIntegrationMode.INTERNAL) {
      return null;
    }

    const envName = this.getProviderEnvName(provider);
    const configured = this.parsePositiveInteger(process.env[envName]);
    if (configured !== undefined) return configured;

    const globalDefault = this.parsePositiveInteger(
      process.env.PAYMENT_PROVIDER_TIMEOUT_DEFAULT_MS,
    );
    if (globalDefault !== undefined) return globalDefault;

    return PaymentProviderTimeoutService.DEFAULT_TIMEOUTS_MS[provider];
  }

  private getProviderEnvName(provider: PaymentProvider): string {
    return `PAYMENT_PROVIDER_TIMEOUT_${provider}_MS`;
  }

  private parsePositiveInteger(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
    return parsed;
  }
}
