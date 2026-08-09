import { HttpStatus } from '@nestjs/common';
import {
  PaymentGatewayErrorClassifierService,
  PaymentGatewayException,
} from './payment-gateway-error-classifier.service';

describe('PaymentGatewayErrorClassifierService', () => {
  let service: PaymentGatewayErrorClassifierService;

  beforeEach(() => {
    service = new PaymentGatewayErrorClassifierService();
  });

  it('deve classificar timeout como retryable', () => {
    const result = service.classify({ code: 'ETIMEDOUT' });
    expect(result.errorCode).toBe('PAYMENT_TIMEOUT');
    expect(result.retryable).toBe(true);
    expect(result.getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT);
  });

  it('deve classificar falha de conexão como retryable', () => {
    const result = service.classify({ code: 'ECONNRESET' });
    expect(result.errorCode).toBe('PROVIDER_CONNECTION_FAILURE');
    expect(result.retryable).toBe(true);
  });

  it.each([
    [401, 'INVALID_PROVIDER_CREDENTIAL', false],
    [403, 'PROVIDER_ACCESS_DENIED', false],
    [404, 'PROVIDER_RESOURCE_NOT_FOUND', false],
    [409, 'PROVIDER_CONFLICT', false],
    [429, 'PROVIDER_RATE_LIMIT', true],
    [500, 'PROVIDER_TEMPORARY_FAILURE', true],
    [503, 'PROVIDER_TEMPORARY_FAILURE', true],
  ] as const)('deve classificar HTTP %s como %s', (status, code, retryable) => {
    const result = service.classify({ response: { status } });
    expect(result.errorCode).toBe(code);
    expect(result.retryable).toBe(retryable);
    expect(result.providerStatus).toBe(status);
  });

  it('deve classificar pagamento recusado sem permitir retry automático', () => {
    const result = service.classify({ code: 'card_declined' });
    expect(result.errorCode).toBe('PAYMENT_DECLINED');
    expect(result.retryable).toBe(false);
  });

  it('deve retornar UNKNOWN_PROVIDER_ERROR para erro desconhecido', () => {
    const result = service.classify(new Error('erro inesperado'));
    expect(result.errorCode).toBe('UNKNOWN_PROVIDER_ERROR');
    expect(result.retryable).toBe(false);
  });

  it('não deve reclassificar PaymentGatewayException já normalizada', () => {
    const existing = new PaymentGatewayException(
      'PROVIDER_RATE_LIMIT',
      'rate limit',
      true,
      503,
      429,
    );
    expect(service.classify(existing)).toBe(existing);
  });
});
