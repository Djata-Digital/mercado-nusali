import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import { PaymentProviderFactory } from '../providers/payment-provider.factory';
import { PaymentProviderIntegrationMode } from '../providers/payment-provider.interface';
import { PaymentGatewayException } from './payment-gateway-error-classifier.service';
import { PaymentLogSanitizerService } from './payment-log-sanitizer.service';

export interface PaymentProviderValidationResult {
  provider: PaymentProvider;
  integrationMode: PaymentProviderIntegrationMode;
  enabled: boolean;
  valid: boolean;
  issues: string[];
}

/**
 * PaymentProviderValidatorService
 *
 * Valida, sem expor valores secretos, se cada adapter está habilitado e possui
 * a configuração necessária. Configuração inválida nunca derruba o bootstrap:
 * o provider fica indisponível e a chamada é rejeitada antes de atingir o
 * gateway.
 *
 * Regras padrão:
 * - INTERNAL: habilitado;
 * - SIMULATED: habilitado fora de production; em production exige opt-in;
 * - EXTERNAL: desabilitado por padrão e, quando habilitado, exige BASE_URL,
 *   CLIENT_ID e CLIENT_SECRET (ou lista customizada REQUIRED_ENV).
 */
@Injectable()
export class PaymentProviderValidatorService implements OnModuleInit {
  private readonly logger = new Logger(PaymentProviderValidatorService.name);

  constructor(
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly sanitizer: PaymentLogSanitizerService,
  ) {}

  onModuleInit(): void {
    for (const result of this.validateAll()) {
      const safe = JSON.stringify(this.sanitizer.sanitize(result));
      if (!result.enabled || !result.valid) {
        this.logger.warn(`Payment provider indisponível: ${safe}`);
      } else {
        this.logger.log(`Payment provider validado: ${safe}`);
      }
    }
  }

  validateAll(): PaymentProviderValidationResult[] {
    return this.paymentProviderFactory
      .listCapabilities()
      .map((capability) => this.validateCapability(capability));
  }

  assertEnabled(provider: PaymentProvider): void {
    const capability = this.paymentProviderFactory
      .listCapabilities()
      .find((item) => item.provider === provider);

    if (!capability) {
      throw new PaymentGatewayException(
        'PROVIDER_UNAVAILABLE',
        `O provider ${provider} não está registrado no Payment Core.`,
        false,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const result = this.validateCapability(capability);
    if (result.enabled && result.valid) return;

    throw new PaymentGatewayException(
      'PROVIDER_UNAVAILABLE',
      `O provider ${provider} está desabilitado ou possui configuração inválida.`,
      false,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private validateCapability(capability: {
    provider: PaymentProvider;
    integrationMode: PaymentProviderIntegrationMode;
  }): PaymentProviderValidationResult {
    const provider = capability.provider;
    const prefix = `PAYMENT_PROVIDER_${provider}`;
    const issues: string[] = [];
    const enabled = this.resolveEnabled(provider, capability.integrationMode);

    if (enabled && capability.integrationMode === PaymentProviderIntegrationMode.EXTERNAL) {
      const requiredEnv = this.requiredExternalEnv(prefix);
      for (const envName of requiredEnv) {
        if (!process.env[envName]?.trim()) {
          issues.push(`Variável obrigatória ausente: ${envName}`);
        }
      }

      const baseUrlName = `${prefix}_BASE_URL`;
      const baseUrl = process.env[baseUrlName]?.trim();
      if (baseUrl && !this.isValidHttpUrl(baseUrl)) {
        issues.push(`URL inválida em ${baseUrlName}`);
      }
    }

    if (
      enabled &&
      capability.integrationMode === PaymentProviderIntegrationMode.SIMULATED &&
      process.env.NODE_ENV === 'production' &&
      process.env.PAYMENT_ALLOW_SIMULATED_PROVIDERS !== 'true'
    ) {
      issues.push(
        'Provider simulado não pode ser ativado em production sem PAYMENT_ALLOW_SIMULATED_PROVIDERS=true.',
      );
    }

    return {
      provider,
      integrationMode: capability.integrationMode,
      enabled,
      valid: issues.length === 0,
      issues,
    };
  }

  private resolveEnabled(
    provider: PaymentProvider,
    mode: PaymentProviderIntegrationMode,
  ): boolean {
    const explicit = process.env[`PAYMENT_PROVIDER_${provider}_ENABLED`];
    if (explicit !== undefined) return explicit.trim().toLowerCase() === 'true';

    if (mode === PaymentProviderIntegrationMode.INTERNAL) return true;
    if (mode === PaymentProviderIntegrationMode.SIMULATED) {
      return process.env.NODE_ENV !== 'production';
    }
    return false;
  }

  private requiredExternalEnv(prefix: string): string[] {
    const custom = process.env[`${prefix}_REQUIRED_ENV`]
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    return custom?.length
      ? custom
      : [`${prefix}_BASE_URL`, `${prefix}_CLIENT_ID`, `${prefix}_CLIENT_SECRET`];
  }

  private isValidHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
