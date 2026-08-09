import { ConflictException } from '@nestjs/common';
import { EscrowStatus, OrderStatus } from '@prisma/client';
import { EscrowDisputePolicyService } from './escrow-dispute-policy.service';

describe('EscrowDisputePolicyService', () => {
  const service = new EscrowDisputePolicyService();

  it('deve permitir abrir disputa com saldo HELD', () => {
    expect(() => service.assertCanOpen(OrderStatus.DELIVERED, EscrowStatus.HELD)).not.toThrow();
  });

  it('deve tratar abertura repetida como idempotente', () => {
    expect(() => service.assertCanOpen(OrderStatus.DISPUTED, EscrowStatus.HELD)).not.toThrow();
  });

  it('deve bloquear disputa em escrow terminal', () => {
    expect(() => service.assertCanOpen(OrderStatus.DELIVERED, EscrowStatus.RELEASED)).toThrow(ConflictException);
  });

  it('deve exigir Order DISPUTED para resolução', () => {
    expect(() => service.assertCanResolve(OrderStatus.DELIVERED, EscrowStatus.HELD, 'BUYER_WINS')).toThrow(ConflictException);
  });

  it('deve permitir BUYER_WINS', () => {
    expect(() => service.assertCanResolve(OrderStatus.DISPUTED, EscrowStatus.HELD, 'BUYER_WINS')).not.toThrow();
  });

  it('deve permitir SELLER_WINS', () => {
    expect(() => service.assertCanResolve(OrderStatus.DISPUTED, EscrowStatus.PARTIALLY_RELEASED, 'SELLER_WINS')).not.toThrow();
  });
});
