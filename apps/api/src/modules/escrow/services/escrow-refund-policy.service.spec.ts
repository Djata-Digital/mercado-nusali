import { ConflictException } from '@nestjs/common';
import { EscrowStatus, OrderStatus, Prisma } from '@prisma/client';
import { EscrowRefundPolicyService } from './escrow-refund-policy.service';

describe('EscrowRefundPolicyService', () => {
  const service = new EscrowRefundPolicyService();

  it('deve reembolsar todo o saldo HELD', () => {
    const decision = service.evaluate({ orderStatus: OrderStatus.CANCELLED, escrowStatus: EscrowStatus.HELD, heldAmount: 100, releasedAmount: 0 });
    expect(decision.refundAmount.eq(100)).toBe(true);
    expect(decision.targetStatus).toBe(EscrowStatus.REFUNDED);
  });

  it('deve permitir refund parcial sem inventar novo status Prisma', () => {
    const decision = service.evaluate({ orderStatus: OrderStatus.RETURNED, escrowStatus: EscrowStatus.HELD, heldAmount: 100, releasedAmount: 0, requestedAmount: 40 });
    expect(decision.isPartial).toBe(true);
    expect(decision.targetStatus).toBe(EscrowStatus.HELD);
  });

  it('deve preservar PARTIALLY_RELEASED ao reembolsar parcialmente o saldo restante', () => {
    const decision = service.evaluate({ orderStatus: OrderStatus.RETURNED, escrowStatus: EscrowStatus.PARTIALLY_RELEASED, heldAmount: new Prisma.Decimal(60), releasedAmount: 40, requestedAmount: 20 });
    expect(decision.targetStatus).toBe(EscrowStatus.PARTIALLY_RELEASED);
  });

  it('deve bloquear refund acima do saldo', () => {
    expect(() => service.evaluate({ orderStatus: OrderStatus.CANCELLED, escrowStatus: EscrowStatus.HELD, heldAmount: 50, releasedAmount: 0, requestedAmount: 60 })).toThrow();
  });

  it('deve bloquear refund automático em disputa', () => {
    expect(() => service.evaluate({ orderStatus: OrderStatus.DISPUTED, escrowStatus: EscrowStatus.HELD, heldAmount: 100, releasedAmount: 0 })).toThrow(ConflictException);
  });

  it('deve permitir refund em disputa somente por resolução explícita', () => {
    const decision = service.evaluate({ orderStatus: OrderStatus.DISPUTED, escrowStatus: EscrowStatus.HELD, heldAmount: 100, releasedAmount: 0, allowDisputed: true });
    expect(decision.targetStatus).toBe(EscrowStatus.REFUNDED);
  });
});
