import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export type PaymentGatewayErrorCode =
  | 'PAYMENT_TIMEOUT'
  | 'PROVIDER_CONNECTION_FAILURE'
  | 'INVALID_PROVIDER_CREDENTIAL'
  | 'PROVIDER_ACCESS_DENIED'
  | 'PROVIDER_RESOURCE_NOT_FOUND'
  | 'PROVIDER_CONFLICT'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_TEMPORARY_FAILURE'
  | 'PROVIDER_UNAVAILABLE'
  | 'PAYMENT_DECLINED'
  | 'UNKNOWN_PROVIDER_ERROR';

/**
 * Exceção interna e estável usada pelo Payment Core.
 *
 * O restante da aplicação não deve depender de formatos de erro específicos
 * de Orange, MTN, PIX, adquirentes de cartão ou qualquer gateway futuro.
 */
export class PaymentGatewayException extends HttpException {
  constructor(
    readonly errorCode: PaymentGatewayErrorCode,
    message: string,
    readonly retryable: boolean,
    statusCode: number,
    readonly providerStatus?: number,
  ) {
    super(
      {
        statusCode,
        message,
        errorCode,
        retryable,
        ...(providerStatus === undefined ? {} : { providerStatus }),
      },
      statusCode,
    );
  }
}

interface ErrorLike {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  response?: {
    status?: unknown;
    statusCode?: unknown;
    data?: unknown;
  };
  message?: unknown;
  name?: unknown;
}

/**
 * Converte erros heterogêneos de gateways em um contrato interno previsível.
 *
 * Importante: este serviço não registra payloads ou headers do erro bruto para
 * não vazar tokens/segredos. Sanitização aprofundada será adicionada em uma
 * etapa dedicada do hardening.
 */
@Injectable()
export class PaymentGatewayErrorClassifierService {
  classify(error: unknown): PaymentGatewayException {
    if (error instanceof PaymentGatewayException) return error;

    const normalized = this.asErrorLike(error);
    const networkCode = this.asString(normalized.code)?.toUpperCase();
    const status = this.extractHttpStatus(normalized);

    if (
      networkCode === 'ETIMEDOUT' ||
      networkCode === 'ESOCKETTIMEDOUT' ||
      networkCode === 'UND_ERR_CONNECT_TIMEOUT' ||
      normalized.name === 'TimeoutError'
    ) {
      return new PaymentGatewayException(
        'PAYMENT_TIMEOUT',
        'O provedor de pagamento excedeu o tempo limite da operação.',
        true,
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }

    if (
      networkCode === 'ECONNRESET' ||
      networkCode === 'ECONNREFUSED' ||
      networkCode === 'EHOSTUNREACH' ||
      networkCode === 'ENETUNREACH' ||
      networkCode === 'EAI_AGAIN'
    ) {
      return new PaymentGatewayException(
        'PROVIDER_CONNECTION_FAILURE',
        'Não foi possível estabelecer comunicação com o provedor de pagamento.',
        true,
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (status === 401) {
      return new PaymentGatewayException(
        'INVALID_PROVIDER_CREDENTIAL',
        'As credenciais configuradas para o provedor de pagamento foram rejeitadas.',
        false,
        HttpStatus.BAD_GATEWAY,
        status,
      );
    }

    if (status === 403) {
      return new PaymentGatewayException(
        'PROVIDER_ACCESS_DENIED',
        'O provedor recusou a operação por falta de autorização.',
        false,
        HttpStatus.BAD_GATEWAY,
        status,
      );
    }

    if (status === 404) {
      return new PaymentGatewayException(
        'PROVIDER_RESOURCE_NOT_FOUND',
        'O recurso solicitado não foi encontrado no provedor de pagamento.',
        false,
        HttpStatus.BAD_GATEWAY,
        status,
      );
    }

    if (status === 409) {
      return new PaymentGatewayException(
        'PROVIDER_CONFLICT',
        'O provedor recusou a operação por conflito de estado.',
        false,
        HttpStatus.CONFLICT,
        status,
      );
    }

    if (status === 429) {
      return new PaymentGatewayException(
        'PROVIDER_RATE_LIMIT',
        'O provedor de pagamento limitou temporariamente novas requisições.',
        true,
        HttpStatus.SERVICE_UNAVAILABLE,
        status,
      );
    }

    if (status !== undefined && status >= 500) {
      return new PaymentGatewayException(
        'PROVIDER_TEMPORARY_FAILURE',
        'O provedor de pagamento apresentou uma falha temporária.',
        true,
        HttpStatus.BAD_GATEWAY,
        status,
      );
    }

    if (this.looksLikeDecline(normalized)) {
      return new PaymentGatewayException(
        'PAYMENT_DECLINED',
        'O pagamento foi recusado pelo provedor.',
        false,
        HttpStatus.UNPROCESSABLE_ENTITY,
        status,
      );
    }

    return new PaymentGatewayException(
      'UNKNOWN_PROVIDER_ERROR',
      'Ocorreu um erro não classificado no provedor de pagamento.',
      false,
      HttpStatus.BAD_GATEWAY,
      status,
    );
  }

  private asErrorLike(error: unknown): ErrorLike {
    if (typeof error === 'object' && error !== null) return error as ErrorLike;
    return { message: typeof error === 'string' ? error : undefined };
  }

  private extractHttpStatus(error: ErrorLike): number | undefined {
    const candidates = [
      error.status,
      error.statusCode,
      error.response?.status,
      error.response?.statusCode,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
      if (typeof candidate === 'string') {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) return parsed;
      }
    }

    return undefined;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private looksLikeDecline(error: ErrorLike): boolean {
    const haystack = [error.code, error.message, error.name]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLowerCase();

    return (
      haystack.includes('declin') ||
      haystack.includes('insufficient_funds') ||
      haystack.includes('insufficient funds') ||
      haystack.includes('payment_rejected')
    );
  }
}
