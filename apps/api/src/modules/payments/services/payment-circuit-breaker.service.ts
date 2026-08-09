import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import { ProviderCircuitOpenException } from '../exceptions/provider-circuit-open.exception';

export enum PaymentCircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface MutablePaymentCircuit {
  state: PaymentCircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
  halfOpenRunning: boolean;
}

export interface PaymentCircuitStatus {
  provider: PaymentProvider;
  state: PaymentCircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
  halfOpenRunning: boolean;
  failureThreshold: number;
  resetTimeoutMs: number;
  retryAfterMs: number;
}

interface RetryableErrorLike {
  retryable?: unknown;
}

/**
 * PaymentCircuitBreakerService
 *
 * Circuit Breaker em memória por provider. Nesta etapa ele é local por processo;
 * quando houver múltiplas réplicas em produção, o mesmo contrato poderá ser
 * mantido e o estado migrado para Redis sem alterar PaymentsService.
 *
 * Somente falhas classificadas como retryable contam para abertura do circuito.
 * Recusas de pagamento, credenciais inválidas e erros de negócio não devem
 * indisponibilizar um provider inteiro.
 */
@Injectable()
export class PaymentCircuitBreakerService {
  private readonly circuits = new Map<PaymentProvider, MutablePaymentCircuit>();

  async execute<T>(
    provider: PaymentProvider,
    operation: () => Promise<T>,
  ): Promise<T> {
    const circuit = this.getOrCreate(provider);
    const resetTimeoutMs = this.getResetTimeoutMs(provider);

    this.moveOpenToHalfOpenWhenReady(circuit, resetTimeoutMs);

    if (circuit.state === PaymentCircuitState.OPEN) {
      throw new ProviderCircuitOpenException(
        provider,
        this.calculateRetryAfterMs(circuit, resetTimeoutMs),
      );
    }

    if (circuit.state === PaymentCircuitState.HALF_OPEN) {
      if (circuit.halfOpenRunning) {
        throw new ProviderCircuitOpenException(provider, resetTimeoutMs);
      }
      // Claim síncrono: somente uma Promise pode executar a chamada de prova.
      circuit.halfOpenRunning = true;
    }

    try {
      const result = await operation();
      this.recordSuccess(circuit);
      return result;
    } catch (error: unknown) {
      this.recordFailure(provider, circuit, error);
      throw error;
    } finally {
      if (circuit.state !== PaymentCircuitState.HALF_OPEN) {
        circuit.halfOpenRunning = false;
      }
    }
  }

  /** Snapshot somente leitura para health checks/testes. */
  getStatus(provider: PaymentProvider): PaymentCircuitStatus {
    const circuit = this.getOrCreate(provider);
    const resetTimeoutMs = this.getResetTimeoutMs(provider);
    this.moveOpenToHalfOpenWhenReady(circuit, resetTimeoutMs);

    return {
      provider,
      state: circuit.state,
      consecutiveFailures: circuit.consecutiveFailures,
      openedAt: circuit.openedAt,
      halfOpenRunning: circuit.halfOpenRunning,
      failureThreshold: this.getFailureThreshold(provider),
      resetTimeoutMs,
      retryAfterMs:
        circuit.state === PaymentCircuitState.OPEN
          ? this.calculateRetryAfterMs(circuit, resetTimeoutMs)
          : 0,
    };
  }

  /** Útil em testes e futura operação administrativa controlada. */
  reset(provider: PaymentProvider): void {
    this.circuits.delete(provider);
  }

  private getOrCreate(provider: PaymentProvider): MutablePaymentCircuit {
    const existing = this.circuits.get(provider);
    if (existing) return existing;

    const created: MutablePaymentCircuit = {
      state: PaymentCircuitState.CLOSED,
      consecutiveFailures: 0,
      openedAt: null,
      halfOpenRunning: false,
    };
    this.circuits.set(provider, created);
    return created;
  }

  private recordSuccess(circuit: MutablePaymentCircuit): void {
    circuit.state = PaymentCircuitState.CLOSED;
    circuit.consecutiveFailures = 0;
    circuit.openedAt = null;
    circuit.halfOpenRunning = false;
  }

  private recordFailure(
    provider: PaymentProvider,
    circuit: MutablePaymentCircuit,
    error: unknown,
  ): void {
    // A tentativa HALF_OPEN que falha com erro retryable reabre imediatamente.
    const wasHalfOpen = circuit.state === PaymentCircuitState.HALF_OPEN;
    circuit.halfOpenRunning = false;

    if (!this.isRetryable(error)) {
      // Falhas funcionais não contam contra a saúde do provider. Se a chamada
      // de prova chegou ao provider, ele está acessível; voltamos a CLOSED.
      if (wasHalfOpen) this.recordSuccess(circuit);
      return;
    }

    circuit.consecutiveFailures += 1;
    const threshold = this.getFailureThreshold(provider);

    if (wasHalfOpen || circuit.consecutiveFailures >= threshold) {
      circuit.state = PaymentCircuitState.OPEN;
      circuit.openedAt = Date.now();
    }
  }

  private moveOpenToHalfOpenWhenReady(
    circuit: MutablePaymentCircuit,
    resetTimeoutMs: number,
  ): void {
    if (
      circuit.state !== PaymentCircuitState.OPEN ||
      circuit.openedAt === null
    ) {
      return;
    }

    if (Date.now() - circuit.openedAt >= resetTimeoutMs) {
      circuit.state = PaymentCircuitState.HALF_OPEN;
      circuit.halfOpenRunning = false;
    }
  }

  private calculateRetryAfterMs(
    circuit: MutablePaymentCircuit,
    resetTimeoutMs: number,
  ): number {
    if (circuit.openedAt === null) return resetTimeoutMs;
    return Math.max(0, resetTimeoutMs - (Date.now() - circuit.openedAt));
  }

  private isRetryable(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    return (error as RetryableErrorLike).retryable === true;
  }

  private getFailureThreshold(provider: PaymentProvider): number {
    const providerValue = this.parsePositiveInteger(
      process.env[`PAYMENT_CB_${provider}_FAILURE_THRESHOLD`],
    );
    if (providerValue !== undefined) return providerValue;

    return (
      this.parsePositiveInteger(process.env.PAYMENT_CB_FAILURE_THRESHOLD) ?? 5
    );
  }

  private getResetTimeoutMs(provider: PaymentProvider): number {
    const providerValue = this.parsePositiveInteger(
      process.env[`PAYMENT_CB_${provider}_RESET_TIMEOUT_MS`],
    );
    if (providerValue !== undefined) return providerValue;

    return (
      this.parsePositiveInteger(process.env.PAYMENT_CB_RESET_TIMEOUT_MS) ??
      60_000
    );
  }

  private parsePositiveInteger(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
    return parsed;
  }
}
