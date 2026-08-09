import { ConflictException, Injectable } from '@nestjs/common';
import { EscrowStatus, OrderStatus } from '@prisma/client';

export type EscrowDisputeOutcome = 'BUYER_WINS' | 'SELLER_WINS';

@Injectable()
export class EscrowDisputePolicyService {
  assertCanOpen(orderStatus: OrderStatus, escrowStatus: EscrowStatus): void {
    if (escrowStatus === EscrowStatus.RELEASED || escrowStatus === EscrowStatus.REFUNDED || escrowStatus === EscrowStatus.CANCELLED) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Não é possível abrir disputa para uma conta de Escrow terminal.',
        errorCode: 'ESCROW_TERMINAL_DISPUTE_FORBIDDEN',
      });
    }
    if (orderStatus === OrderStatus.DISPUTED) return;
    if (orderStatus === OrderStatus.CANCELLED || orderStatus === OrderStatus.REFUNDED || orderStatus === OrderStatus.FAILED || orderStatus === OrderStatus.EXPIRED) {
      throw new ConflictException({
        statusCode: 409,
        message: 'O estado atual do pedido não permite abertura de disputa.',
        errorCode: 'ESCROW_ORDER_NOT_DISPUTABLE',
      });
    }
  }

  assertCanResolve(orderStatus: OrderStatus, escrowStatus: EscrowStatus, outcome: EscrowDisputeOutcome): void {
    if (orderStatus !== OrderStatus.DISPUTED) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Somente pedidos em disputa podem ser resolvidos.',
        errorCode: 'ESCROW_ORDER_NOT_DISPUTED',
      });
    }
    if (escrowStatus !== EscrowStatus.HELD && escrowStatus !== EscrowStatus.PARTIALLY_RELEASED) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A conta de Escrow não possui saldo resolvível em disputa.',
        errorCode: 'ESCROW_DISPUTE_NOT_RESOLVABLE',
      });
    }
    if (outcome !== 'BUYER_WINS' && outcome !== 'SELLER_WINS') {
      throw new ConflictException({ statusCode: 409, message: 'Resultado de disputa inválido.', errorCode: 'ESCROW_INVALID_DISPUTE_OUTCOME' });
    }
  }
}
