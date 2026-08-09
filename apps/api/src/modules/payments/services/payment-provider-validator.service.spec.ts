import { PaymentProvider } from '@prisma/client';

import { PaymentProviderIntegrationMode } from '../providers/payment-provider.interface';
import { PaymentProviderValidatorService } from './payment-provider-validator.service';
import { PaymentLogSanitizerService } from './payment-log-sanitizer.service';

describe('PaymentProviderValidatorService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function createService(capabilities: any[]) {
    return new PaymentProviderValidatorService(
      { listCapabilities: jest.fn().mockReturnValue(capabilities) } as any,
      new PaymentLogSanitizerService(),
    );
  }

  it('deve considerar provider INTERNAL habilitado por padrão', () => {
    const service = createService([
      {
        provider: PaymentProvider.NUSALI,
        integrationMode: PaymentProviderIntegrationMode.INTERNAL,
      },
    ]);

    expect(service.validateAll()[0]).toMatchObject({
      enabled: true,
      valid: true,
    });
    expect(() => service.assertEnabled(PaymentProvider.NUSALI)).not.toThrow();
  });

  it('deve permitir desabilitar provider explicitamente', () => {
    process.env.PAYMENT_PROVIDER_ORANGE_ENABLED = 'false';
    const service = createService([
      {
        provider: PaymentProvider.ORANGE,
        integrationMode: PaymentProviderIntegrationMode.SIMULATED,
      },
    ]);

    expect(service.validateAll()[0].enabled).toBe(false);
    expect(() => service.assertEnabled(PaymentProvider.ORANGE)).toThrow();
  });

  it('deve desabilitar SIMULATED por padrão em production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PAYMENT_PROVIDER_ORANGE_ENABLED;
    const service = createService([
      {
        provider: PaymentProvider.ORANGE,
        integrationMode: PaymentProviderIntegrationMode.SIMULATED,
      },
    ]);

    expect(service.validateAll()[0].enabled).toBe(false);
  });

  it('deve validar credenciais obrigatórias de provider EXTERNAL habilitado', () => {
    process.env.PAYMENT_PROVIDER_ORANGE_ENABLED = 'true';
    const service = createService([
      {
        provider: PaymentProvider.ORANGE,
        integrationMode: PaymentProviderIntegrationMode.EXTERNAL,
      },
    ]);

    const result = service.validateAll()[0];
    expect(result.enabled).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.issues.join(' ')).toContain('BASE_URL');
    expect(result.issues.join(' ')).toContain('CLIENT_SECRET');
  });

  it('deve aceitar configuração EXTERNAL completa e URL válida', () => {
    process.env.PAYMENT_PROVIDER_ORANGE_ENABLED = 'true';
    process.env.PAYMENT_PROVIDER_ORANGE_BASE_URL = 'https://payments.example.com';
    process.env.PAYMENT_PROVIDER_ORANGE_CLIENT_ID = 'client';
    process.env.PAYMENT_PROVIDER_ORANGE_CLIENT_SECRET = 'secret';

    const service = createService([
      {
        provider: PaymentProvider.ORANGE,
        integrationMode: PaymentProviderIntegrationMode.EXTERNAL,
      },
    ]);

    expect(service.validateAll()[0]).toMatchObject({ enabled: true, valid: true });
  });

  it('deve rejeitar URL externa inválida', () => {
    process.env.PAYMENT_PROVIDER_ORANGE_ENABLED = 'true';
    process.env.PAYMENT_PROVIDER_ORANGE_BASE_URL = 'not-a-url';
    process.env.PAYMENT_PROVIDER_ORANGE_CLIENT_ID = 'client';
    process.env.PAYMENT_PROVIDER_ORANGE_CLIENT_SECRET = 'secret';

    const service = createService([
      {
        provider: PaymentProvider.ORANGE,
        integrationMode: PaymentProviderIntegrationMode.EXTERNAL,
      },
    ]);

    expect(service.validateAll()[0].valid).toBe(false);
    expect(service.validateAll()[0].issues.join(' ')).toContain('URL inválida');
  });
});
