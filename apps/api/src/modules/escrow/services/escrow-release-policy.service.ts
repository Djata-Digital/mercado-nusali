import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EscrowStatus, OrderStatus, Prisma } from '@prisma/client';

export interface EscrowReleasePolicyInput {
  orderStatus: OrderStatus;
  escrowStatus: EscrowStatus;
  heldAmount: Prisma.Decimal | number | string;
  requestedAmount?: Prisma.Decimal | number | string;
  disputeDeadline?: Date | null;
  now?: Date;
}

export interface EscrowReleaseDecision {
  releaseAmount: Prisma.Decimal;
  targetStatus: EscrowStatus;
  isPartial: boolean;
}

/**
 * Regras puras para autorizar uma liberação de Escrow.
 *
 * A política não toca no banco e não movimenta Wallet/Ledger. Isso permite
 * testar as regras de liberação isoladamente e reaproveitá-las no serviço
 * transacional nas próximas etapas da Sprint 7.2.
 */
@Injectable()
export class EscrowReleasePolicyService {
  evaluate(input: EscrowReleasePolicyInput): EscrowReleaseDecision {
    if (
      input.escrowStatus !== EscrowStatus.HELD &&
      input.escrowStatus !== EscrowStatus.PARTIALLY_RELEASED
    ) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A conta de Escrow não está disponível para liberação.',
        errorCode: 'ESCROW_NOT_RELEASABLE',
      });
    }

    if (input.orderStatus === OrderStatus.DISPUTED) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Pedido em disputa não pode liberar fundos de Escrow.',
        errorCode: 'ESCROW_ORDER_DISPUTED',
      });
    }

    if (
      input.orderStatus !== OrderStatus.DELIVERED &&
      input.orderStatus !== OrderStatus.COMPLETED
    ) {
      throw new ConflictException({
        statusCode: 409,
        message: 'O pedido ainda não está elegível para liberação do Escrow.',
        errorCode: 'ESCROW_ORDER_NOT_DELIVERED',
      });
    }

    const heldAmount = new Prisma.Decimal(input.heldAmount);
    const releaseAmount =
      input.requestedAmount === undefined
        ? heldAmount
        : new Prisma.Decimal(input.requestedAmount);

    if (heldAmount.lte(0)) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Não existe saldo retido disponível para liberação.',
        errorCode: 'ESCROW_NO_HELD_BALANCE',
      });
    }

    if (releaseAmount.lte(0)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'O valor de liberação deve ser positivo.',
        errorCode: 'ESCROW_INVALID_RELEASE_AMOUNT',
      });
    }

    if (releaseAmount.gt(heldAmount)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'O valor de liberação é superior ao saldo retido.',
        errorCode: 'ESCROW_RELEASE_EXCEEDS_HELD_AMOUNT',
      });
    }

    const isPartial = releaseAmount.lt(heldAmount);

    return {
      releaseAmount,
      isPartial,
      targetStatus: isPartial
        ? EscrowStatus.PARTIALLY_RELEASED
        : EscrowStatus.RELEASED,
    };
  }
}
