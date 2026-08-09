import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';

import { sanitizeForJson } from '../../../common/utils/decimal.util';

export interface PaymentTransitionInput {
  paymentId: string;
  toStatus: PaymentStatus;
  eventType?: string;
  payload?: unknown;
}

/**
 * PaymentStateMachineService
 *
 * Fonte única de verdade para transições de status de Payment.
 *
 * Regras:
 * - transições são explícitas; não existe ordenação numérica de estados;
 * - repetir o mesmo estado é idempotente e não duplica PaymentEvent;
 * - estados terminais não podem regressar;
 * - a atualização usa compare-and-set (id + status atual) para detectar concorrência;
 * - PaymentEvent é gravado no mesmo TransactionClient da alteração de status.
 *
 * Este serviço altera somente o estado do pagamento e seu histórico. Efeitos
 * financeiros (Escrow, Wallet, Ledger, Order etc.) permanecem sob responsabilidade
 * do fluxo de aplicação que controla a mesma transação.
 */
@Injectable()
export class PaymentStateMachineService {
  private readonly transitions: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
    [PaymentStatus.CREATED]: [
      PaymentStatus.PENDING,
      PaymentStatus.PROCESSING,
      PaymentStatus.AUTHORIZED,
      PaymentStatus.CAPTURED,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
      PaymentStatus.EXPIRED,
    ],
    [PaymentStatus.PENDING]: [
      PaymentStatus.PROCESSING,
      PaymentStatus.AUTHORIZED,
      PaymentStatus.CAPTURED,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
      PaymentStatus.EXPIRED,
    ],
    [PaymentStatus.PROCESSING]: [
      PaymentStatus.PENDING,
      PaymentStatus.AUTHORIZED,
      PaymentStatus.CAPTURED,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
      PaymentStatus.EXPIRED,
    ],
    [PaymentStatus.AUTHORIZED]: [
      PaymentStatus.PROCESSING,
      PaymentStatus.CAPTURED,
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
      PaymentStatus.EXPIRED,
    ],
    [PaymentStatus.CAPTURED]: [
      PaymentStatus.PARTIALLY_REFUNDED,
      PaymentStatus.REFUNDED,
    ],
    [PaymentStatus.PARTIALLY_REFUNDED]: [PaymentStatus.REFUNDED],
    [PaymentStatus.FAILED]: [],
    [PaymentStatus.CANCELLED]: [],
    [PaymentStatus.EXPIRED]: [],
    [PaymentStatus.REFUNDED]: [],
  };

  private readonly terminalStatuses = new Set<PaymentStatus>([
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
    PaymentStatus.REFUNDED,
  ]);

  canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    if (from === to) return true;
    return this.transitions[from]?.includes(to) ?? false;
  }

  isTerminal(status: PaymentStatus): boolean {
    return this.terminalStatuses.has(status);
  }

  assertTransition(from: PaymentStatus, to: PaymentStatus): void {
    if (this.canTransition(from, to)) return;

    throw new ConflictException({
      statusCode: 409,
      message: `Transição de pagamento inválida: ${from} -> ${to}.`,
      errorCode: 'PAYMENT_INVALID_STATUS_TRANSITION',
      currentStatus: from,
      requestedStatus: to,
    });
  }

  async transition(
    tx: Prisma.TransactionClient,
    input: PaymentTransitionInput,
  ) {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
    });

    if (!payment) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Pagamento não encontrado.',
        errorCode: 'PAYMENT_NOT_FOUND',
      });
    }

    // Repetição da mesma transição é uma operação idempotente.
    if (payment.status === input.toStatus) return payment;

    this.assertTransition(payment.status, input.toStatus);

    const updated = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: payment.status,
      },
      data: {
        status: input.toStatus,
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException({
        statusCode: 409,
        message: 'O pagamento foi alterado por outra operação.',
        errorCode: 'PAYMENT_CONCURRENT_MODIFICATION',
      });
    }

    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        eventType:
          input.eventType ?? `PAYMENT_${input.toStatus.toUpperCase()}`,
        previousStatus: payment.status,
        newStatus: input.toStatus,
        payloadJson:
          input.payload === undefined ? undefined : sanitizeForJson(input.payload),
      },
    });

    return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
  }
}
