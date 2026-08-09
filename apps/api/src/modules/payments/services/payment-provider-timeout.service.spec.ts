import { PaymentProvider } from '@prisma/client';

import { PaymentProviderIntegrationMode } from '../providers/payment-provider.interface';
import {
  PaymentProviderTimeoutError,
  PaymentProviderTimeoutService,
} from './payment-provider-timeout.service';

const makeProvider = (
  providerName: PaymentProvider,
  integrationMode: PaymentProviderIntegrationMode,
) => ({ providerName, integrationMode });

describe('PaymentProviderTimeoutService', () => {
  let service: PaymentProviderTimeoutService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    service = new PaymentProviderTimeoutService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('deve retornar normalmente quando o provider responder antes do timeout', async () => {
    process.env.PAYMENT_PROVIDER_TIMEOUT_ORANGE_MS = '100';

    const result = await service.invoke(
      makeProvider(
        PaymentProvider.ORANGE,
        PaymentProviderIntegrationMode.EXTERNAL,
      ),
      async () => ({ success: true }),
    );

    expect(result.result).toEqual({ success: true });
    expect(result.timeoutMs).toBe(100);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('deve interromper a espera com ETIMEDOUT quando o provider exceder o limite', async () => {
    process.env.PAYMENT_PROVIDER_TIMEOUT_ORANGE_MS = '10';

    const pending = service.invoke(
      makeProvider(
        PaymentProvider.ORANGE,
        PaymentProviderIntegrationMode.EXTERNAL,
      ),
      () => new Promise(() => undefined),
    );

    const expectation = expect(pending).rejects.toMatchObject({
      code: 'ETIMEDOUT',
      provider: PaymentProvider.ORANGE,
      timeoutMs: 10,
    });

    await expectation;
  });

  it('deve gerar PaymentProviderTimeoutError tipado', () => {
    const error = new PaymentProviderTimeoutError(
      PaymentProvider.PIX_INTERNAL,
      10000,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('ETIMEDOUT');
    expect(error.provider).toBe(PaymentProvider.PIX_INTERNAL);
  });

  it('deve ignorar timeout externo para provider INTERNAL', () => {
    process.env.PAYMENT_PROVIDER_TIMEOUT_NUSALI_MS = '1';

    expect(
      service.getTimeoutMs(
        PaymentProvider.NUSALI,
        PaymentProviderIntegrationMode.INTERNAL,
      ),
    ).toBeNull();
  });

  it('deve permitir configuração individual por provider', () => {
    process.env.PAYMENT_PROVIDER_TIMEOUT_MTN_MS = '4567';

    expect(
      service.getTimeoutMs(
        PaymentProvider.MTN,
        PaymentProviderIntegrationMode.EXTERNAL,
      ),
    ).toBe(4567);
  });

  it('deve usar configuração global quando não houver override individual', () => {
    process.env.PAYMENT_PROVIDER_TIMEOUT_DEFAULT_MS = '7654';

    expect(
      service.getTimeoutMs(
        PaymentProvider.PIX_INTERNAL,
        PaymentProviderIntegrationMode.SIMULATED,
      ),
    ).toBe(7654);
  });

  it('deve ignorar configuração inválida e usar o padrão seguro', () => {
    process.env.PAYMENT_PROVIDER_TIMEOUT_CARD_INTERNAL_MS = '-1';
    process.env.PAYMENT_PROVIDER_TIMEOUT_DEFAULT_MS = 'abc';

    expect(
      service.getTimeoutMs(
        PaymentProvider.CARD_INTERNAL,
        PaymentProviderIntegrationMode.SIMULATED,
      ),
    ).toBe(20_000);
  });
});
