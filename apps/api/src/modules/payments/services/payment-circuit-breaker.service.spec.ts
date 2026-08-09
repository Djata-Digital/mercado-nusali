import { PaymentProvider } from '@prisma/client';

import { ProviderCircuitOpenException } from '../exceptions/provider-circuit-open.exception';
import { PaymentGatewayException } from './payment-gateway-error-classifier.service';
import {
  PaymentCircuitBreakerService,
  PaymentCircuitState,
} from './payment-circuit-breaker.service';

describe('PaymentCircuitBreakerService', () => {
  const originalEnv = { ...process.env };
  let service: PaymentCircuitBreakerService;

  beforeEach(() => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '2';
    process.env.PAYMENT_CB_RESET_TIMEOUT_MS = '1000';
    service = new PaymentCircuitBreakerService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  const retryableFailure = () =>
    new PaymentGatewayException(
      'PROVIDER_TEMPORARY_FAILURE',
      'temporary',
      true,
      502,
    );

  it('deve iniciar CLOSED e permanecer fechado após sucesso', async () => {
    await expect(
      service.execute(PaymentProvider.ORANGE, async () => 'ok'),
    ).resolves.toBe('ok');

    expect(service.getStatus(PaymentProvider.ORANGE)).toMatchObject({
      state: PaymentCircuitState.CLOSED,
      consecutiveFailures: 0,
    });
  });

  it('deve abrir após atingir o limite de falhas retryable', async () => {
    for (let i = 0; i < 2; i += 1) {
      await expect(
        service.execute(PaymentProvider.ORANGE, async () => {
          throw retryableFailure();
        }),
      ).rejects.toBeInstanceOf(PaymentGatewayException);
    }

    expect(service.getStatus(PaymentProvider.ORANGE).state).toBe(
      PaymentCircuitState.OPEN,
    );
  });

  it('deve bloquear nova chamada enquanto OPEN', async () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '1';
    const operation = jest.fn(async () => {
      throw retryableFailure();
    });

    await expect(
      service.execute(PaymentProvider.ORANGE, operation),
    ).rejects.toBeInstanceOf(PaymentGatewayException);

    operation.mockClear();
    await expect(
      service.execute(PaymentProvider.ORANGE, operation),
    ).rejects.toBeInstanceOf(ProviderCircuitOpenException);
    expect(operation).not.toHaveBeenCalled();
  });

  it('deve mudar para HALF_OPEN após reset timeout e fechar após sucesso', async () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '1';
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    await expect(
      service.execute(PaymentProvider.ORANGE, async () => {
        throw retryableFailure();
      }),
    ).rejects.toBeInstanceOf(PaymentGatewayException);

    nowSpy.mockReturnValue(2_001);
    expect(service.getStatus(PaymentProvider.ORANGE).state).toBe(
      PaymentCircuitState.HALF_OPEN,
    );

    await expect(
      service.execute(PaymentProvider.ORANGE, async () => 'recovered'),
    ).resolves.toBe('recovered');
    expect(service.getStatus(PaymentProvider.ORANGE).state).toBe(
      PaymentCircuitState.CLOSED,
    );
  });

  it('deve reabrir após falha retryable em HALF_OPEN', async () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '1';
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    await expect(
      service.execute(PaymentProvider.ORANGE, async () => {
        throw retryableFailure();
      }),
    ).rejects.toBeInstanceOf(PaymentGatewayException);

    nowSpy.mockReturnValue(2_001);
    await expect(
      service.execute(PaymentProvider.ORANGE, async () => {
        throw retryableFailure();
      }),
    ).rejects.toBeInstanceOf(PaymentGatewayException);

    expect(service.getStatus(PaymentProvider.ORANGE).state).toBe(
      PaymentCircuitState.OPEN,
    );
  });

  it('deve permitir apenas uma chamada concorrente em HALF_OPEN', async () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '1';
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000);

    await expect(
      service.execute(PaymentProvider.ORANGE, async () => {
        throw retryableFailure();
      }),
    ).rejects.toBeInstanceOf(PaymentGatewayException);

    nowSpy.mockReturnValue(2_001);
    let resolveProbe!: (value: string) => void;
    const probe = new Promise<string>((resolve) => {
      resolveProbe = resolve;
    });

    const first = service.execute(PaymentProvider.ORANGE, () => probe);
    await expect(
      service.execute(PaymentProvider.ORANGE, async () => 'second'),
    ).rejects.toBeInstanceOf(ProviderCircuitOpenException);

    resolveProbe('ok');
    await expect(first).resolves.toBe('ok');
  });

  it('deve manter circuitos independentes por provider', async () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '1';

    await expect(
      service.execute(PaymentProvider.ORANGE, async () => {
        throw retryableFailure();
      }),
    ).rejects.toBeInstanceOf(PaymentGatewayException);

    expect(service.getStatus(PaymentProvider.ORANGE).state).toBe(
      PaymentCircuitState.OPEN,
    );
    expect(service.getStatus(PaymentProvider.MTN).state).toBe(
      PaymentCircuitState.CLOSED,
    );
  });

  it('não deve abrir circuito por erro não retryable', async () => {
    const declined = new PaymentGatewayException(
      'PAYMENT_DECLINED',
      'declined',
      false,
      422,
    );

    for (let i = 0; i < 4; i += 1) {
      await expect(
        service.execute(PaymentProvider.ORANGE, async () => {
          throw declined;
        }),
      ).rejects.toBe(declined);
    }

    expect(service.getStatus(PaymentProvider.ORANGE)).toMatchObject({
      state: PaymentCircuitState.CLOSED,
      consecutiveFailures: 0,
    });
  });

  it('deve respeitar threshold específico do provider', async () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '5';
    process.env.PAYMENT_CB_ORANGE_FAILURE_THRESHOLD = '1';

    await expect(
      service.execute(PaymentProvider.ORANGE, async () => {
        throw retryableFailure();
      }),
    ).rejects.toBeInstanceOf(PaymentGatewayException);

    expect(service.getStatus(PaymentProvider.ORANGE).failureThreshold).toBe(1);
    expect(service.getStatus(PaymentProvider.ORANGE).state).toBe(
      PaymentCircuitState.OPEN,
    );
  });
});
