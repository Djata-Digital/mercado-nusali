import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EscrowStatus, OrderStatus, Prisma } from '@prisma/client';

export interface EscrowRefundPolicyInput {
  orderStatus: OrderStatus;
  escrowStatus: EscrowStatus;
  heldAmount: Prisma.Decimal | number | string;
  releasedAmount: Prisma.Decimal | number | string;
  requestedAmount?: Prisma.Decimal | number | string;
  allowDisputed?: boolean;
}

export interface EscrowRefundDecision {
  refundAmount: Prisma.Decimal;
  targetStatus: EscrowStatus;
  isPartial: boolean;
}

/** Regras puras para devolução do saldo ainda retido em Escrow. */
@Injectable()
export class EscrowRefundPolicyService {
  evaluate(input: EscrowRefundPolicyInput): EscrowRefundDecision {
    if (
      input.escrowStatus !== EscrowStatus.HELD &&
      input.escrowStatus !== EscrowStatus.PARTIALLY_RELEASED
    ) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A conta de Escrow não está disponível para reembolso.',
        errorCode: 'ESCROW_NOT_REFUNDABLE',
      });
    }

    if (input.orderStatus === OrderStatus.DISPUTED && !input.allowDisputed) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Pedido em disputa exige resolução explícita antes do reembolso.',
        errorCode: 'ESCROW_ORDER_DISPUTED',
      });
    }

    const heldAmount = new Prisma.Decimal(input.heldAmount);
    const releasedAmount = new Prisma.Decimal(input.releasedAmount);
    const refundAmount = input.requestedAmount === undefined
      ? heldAmount
      : new Prisma.Decimal(input.requestedAmount);

    if (heldAmount.lte(0)) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Não existe saldo retido disponível para reembolso.',
        errorCode: 'ESCROW_NO_HELD_BALANCE',
      });
    }
    if (refundAmount.lte(0)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'O valor do reembolso deve ser positivo.',
        errorCode: 'ESCROW_INVALID_REFUND_AMOUNT',
      });
    }
    if (refundAmount.gt(heldAmount)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'O valor do reembolso é superior ao saldo ainda retido.',
        errorCode: 'ESCROW_REFUND_EXCEEDS_HELD_AMOUNT',
      });
    }

    const isPartial = refundAmount.lt(heldAmount);
    const targetStatus = isPartial
      ? (releasedAmount.gt(0) ? EscrowStatus.PARTIALLY_RELEASED : EscrowStatus.HELD)
      : EscrowStatus.REFUNDED;

    return { refundAmount, targetStatus, isPartial };
  }
}
