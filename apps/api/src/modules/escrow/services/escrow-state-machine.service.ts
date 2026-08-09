import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EscrowStatus, Prisma } from '@prisma/client';

export interface EscrowTransitionInput {
  escrowAccountId: string;
  toStatus: EscrowStatus;
}

export interface EscrowReleaseTransitionInput {
  escrowAccountId: string;
  toStatus: EscrowStatus;
  expectedStatus: EscrowStatus;
  expectedHeldAmount: Prisma.Decimal;
  expectedReleasedAmount: Prisma.Decimal;
  releaseAmount: Prisma.Decimal;
}

export interface EscrowRefundTransitionInput {
  escrowAccountId: string;
  toStatus: EscrowStatus;
  expectedStatus: EscrowStatus;
  expectedHeldAmount: Prisma.Decimal;
  expectedRefundedAmount: Prisma.Decimal;
  refundAmount: Prisma.Decimal;
}

/**
 * Máquina de estados central do Escrow.
 *
 * O schema atual modela uma conta recém-financiada diretamente como HELD.
 * Por isso HELD representa o estado "funded/retido". A introdução de estados
 * adicionais (ex.: DISPUTED) será feita somente quando houver modelo de disputa
 * persistente, evitando um enum que não tenha suporte operacional real.
 */
@Injectable()
export class EscrowStateMachineService {
  private readonly transitions: Record<EscrowStatus, readonly EscrowStatus[]> = {
    [EscrowStatus.HELD]: [
      EscrowStatus.PARTIALLY_RELEASED,
      EscrowStatus.RELEASED,
      EscrowStatus.REFUNDED,
      EscrowStatus.CANCELLED,
    ],
    [EscrowStatus.PARTIALLY_RELEASED]: [
      EscrowStatus.PARTIALLY_RELEASED,
      EscrowStatus.RELEASED,
      EscrowStatus.REFUNDED,
      EscrowStatus.CANCELLED,
    ],
    [EscrowStatus.RELEASED]: [],
    [EscrowStatus.REFUNDED]: [],
    [EscrowStatus.CANCELLED]: [],
  };

  isTerminal(status: EscrowStatus): boolean {
    return this.transitions[status].length === 0;
  }

  canTransition(from: EscrowStatus, to: EscrowStatus): boolean {
    if (from === to) return true;
    return this.transitions[from].includes(to);
  }

  /**
   * Faz a transição de status e a movimentação dos saldos do Escrow em um
   * único compare-and-set. Esse método é usado pelo payout para impedir que
   * dois workers consumam o mesmo saldo retido.
   */
  async transitionRelease(
    tx: Prisma.TransactionClient,
    input: EscrowReleaseTransitionInput,
  ) {
    if (!this.canTransition(input.expectedStatus, input.toStatus)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Transição de Escrow inválida: ${input.expectedStatus} -> ${input.toStatus}.`,
        errorCode: 'ESCROW_INVALID_STATUS_TRANSITION',
      });
    }

    const claimed = await tx.escrowAccount.updateMany({
      where: {
        id: input.escrowAccountId,
        status: input.expectedStatus,
        heldAmount: input.expectedHeldAmount,
        releasedAmount: input.expectedReleasedAmount,
      },
      data: {
        status: input.toStatus,
        heldAmount: { decrement: input.releaseAmount },
        releasedAmount: { increment: input.releaseAmount },
      },
    });

    if (claimed.count !== 1) {
      throw new ConflictException({
        statusCode: 409,
        message: 'O saldo de Escrow foi alterado por outra operação.',
        errorCode: 'ESCROW_CONCURRENT_MODIFICATION',
      });
    }

    return tx.escrowAccount.findUniqueOrThrow({
      where: { id: input.escrowAccountId },
    });
  }

  /** Claim atômico do saldo devolvido ao comprador. */
  async transitionRefund(
    tx: Prisma.TransactionClient,
    input: EscrowRefundTransitionInput,
  ) {
    if (!this.canTransition(input.expectedStatus, input.toStatus)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Transição de Escrow inválida: ${input.expectedStatus} -> ${input.toStatus}.`,
        errorCode: 'ESCROW_INVALID_STATUS_TRANSITION',
      });
    }

    const claimed = await tx.escrowAccount.updateMany({
      where: {
        id: input.escrowAccountId,
        status: input.expectedStatus,
        heldAmount: input.expectedHeldAmount,
        refundedAmount: input.expectedRefundedAmount,
      },
      data: {
        status: input.toStatus,
        heldAmount: { decrement: input.refundAmount },
        refundedAmount: { increment: input.refundAmount },
      },
    });

    if (claimed.count !== 1) {
      throw new ConflictException({
        statusCode: 409,
        message: 'O saldo de Escrow foi alterado por outra operação.',
        errorCode: 'ESCROW_CONCURRENT_MODIFICATION',
      });
    }

    return tx.escrowAccount.findUniqueOrThrow({ where: { id: input.escrowAccountId } });
  }

  async transition(
    tx: Prisma.TransactionClient,
    input: EscrowTransitionInput,
  ) {
    const escrow = await tx.escrowAccount.findUnique({
      where: { id: input.escrowAccountId },
    });

    if (!escrow) {
      throw new NotFoundException('Conta de Escrow não encontrada.');
    }

    if (escrow.status === input.toStatus) return escrow;

    if (!this.canTransition(escrow.status, input.toStatus)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Transição de Escrow inválida: ${escrow.status} -> ${input.toStatus}.`,
        errorCode: 'ESCROW_INVALID_STATUS_TRANSITION',
      });
    }

    const claimed = await tx.escrowAccount.updateMany({
      where: {
        id: escrow.id,
        status: escrow.status,
      },
      data: { status: input.toStatus },
    });

    if (claimed.count !== 1) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A conta de Escrow foi alterada por outra operação.',
        errorCode: 'ESCROW_CONCURRENT_MODIFICATION',
      });
    }

    return tx.escrowAccount.findUniqueOrThrow({
      where: { id: escrow.id },
    });
  }
}
