import { HttpStatus } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import { PaymentGatewayException } from '../services/payment-gateway-error-classifier.service';

/**
 * Exceção estável lançada quando o Circuit Breaker impede uma nova chamada.
 * Ela já nasce classificada para que o ErrorClassifier não altere seu código.
 */
export class ProviderCircuitOpenException extends PaymentGatewayException {
  constructor(
    readonly provider: PaymentProvider,
    readonly retryAfterMs: number,
  ) {
    super(
      'PROVIDER_UNAVAILABLE',
      `O provedor ${provider} está temporariamente indisponível. Tente novamente mais tarde.`,
      true,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    this.name = 'ProviderCircuitOpenException';
  }
}
