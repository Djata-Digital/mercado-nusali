import { Injectable } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';

import { sanitizeForJson } from '../../../common/utils/decimal.util';

export interface RecordPaymentAttemptInput {
  paymentId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string;
  durationMs?: number;
}

/**
 * PaymentAttemptsService
 *
 * Mantém o histórico imutável das chamadas feitas a provedores de pagamento.
 * A tentativa é persistida somente depois que a chamada ao provedor termina,
 * registrando sucesso ou falha sem expor segredos diretamente em colunas.
 */
@Injectable()
export class PaymentAttemptsService {
  async record(
    tx: Prisma.TransactionClient,
    input: RecordPaymentAttemptInput,
  ) {
    const previousAttempt = await tx.paymentAttempt.findFirst({
      where: { paymentId: input.paymentId },
      orderBy: { attemptNumber: 'desc' },
      select: { attemptNumber: true },
    });

    const attemptNumber = (previousAttempt?.attemptNumber ?? 0) + 1;

    return tx.paymentAttempt.create({
      data: {
        paymentId: input.paymentId,
        attemptNumber,
        provider: input.provider,
        status: input.status,
        requestPayloadJson:
          input.requestPayload === undefined
            ? undefined
            : sanitizeForJson(input.requestPayload),
        responsePayloadJson:
          input.responsePayload === undefined
            ? input.durationMs === undefined
              ? undefined
              : sanitizeForJson({ durationMs: input.durationMs })
            : sanitizeForJson({
                result: input.responsePayload,
                ...(input.durationMs === undefined
                  ? {}
                  : { durationMs: input.durationMs }),
              }),
        errorMessage: input.errorMessage,
      },
    });
  }
}
