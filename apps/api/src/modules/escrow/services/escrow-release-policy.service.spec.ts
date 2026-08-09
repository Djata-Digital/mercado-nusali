import { BadRequestException, ConflictException } from '@nestjs/common';
import { EscrowStatus, OrderStatus } from '@prisma/client';

import { EscrowReleasePolicyService } from './escrow-release-policy.service';

describe('EscrowReleasePolicyService', () => {
  const service = new EscrowReleasePolicyService();

  it('deve liberar integralmente pedido DELIVERED', () => {
    const decision = service.evaluate({
      orderStatus: OrderStatus.DELIVERED,
      escrowStatus: EscrowStatus.HELD,
      heldAmount: 100,
    });

    expect(decision.releaseAmount.toFixed(2)).toBe('100.00');
    expect(decision.isPartial).toBe(false);
    expect(decision.targetStatus).toBe(EscrowStatus.RELEASED);
  });

  it('deve permitir liberação parcial e manter PARTIALLY_RELEASED', () => {
    const decision = service.evaluate({
      orderStatus: OrderStatus.COMPLETED,
      escrowStatus: EscrowStatus.HELD,
      heldAmount: 100,
      requestedAmount: 40,
    });

    expect(decision.releaseAmount.toFixed(2)).toBe('40.00');
    expect(decision.isPartial).toBe(true);
    expect(decision.targetStatus).toBe(EscrowStatus.PARTIALLY_RELEASED);
  });

  it('deve bloquear pedido ainda não entregue', () => {
    expect(() =>
      service.evaluate({
        orderStatus: OrderStatus.SHIPPED,
        escrowStatus: EscrowStatus.HELD,
        heldAmount: 100,
      }),
    ).toThrow(ConflictException);
  });

  it('deve bloquear pedido em disputa', () => {
    expect(() =>
      service.evaluate({
        orderStatus: OrderStatus.DISPUTED,
        escrowStatus: EscrowStatus.HELD,
        heldAmount: 100,
      }),
    ).toThrow(ConflictException);
  });

  it('deve bloquear liberação maior que o saldo retido', () => {
    expect(() =>
      service.evaluate({
        orderStatus: OrderStatus.DELIVERED,
        escrowStatus: EscrowStatus.HELD,
        heldAmount: 100,
        requestedAmount: 101,
      }),
    ).toThrow(BadRequestException);
  });

  it('deve bloquear conta terminal', () => {
    expect(() =>
      service.evaluate({
        orderStatus: OrderStatus.COMPLETED,
        escrowStatus: EscrowStatus.RELEASED,
        heldAmount: 0,
      }),
    ).toThrow(ConflictException);
  });
});
