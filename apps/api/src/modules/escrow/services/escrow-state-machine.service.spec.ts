import { ConflictException, NotFoundException } from '@nestjs/common';
import { EscrowStatus, Prisma } from '@prisma/client';

import { EscrowStateMachineService } from './escrow-state-machine.service';

describe('EscrowStateMachineService', () => {
  let service: EscrowStateMachineService;
  let tx: {
    escrowAccount: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
  };

  beforeEach(() => {
    service = new EscrowStateMachineService();
    tx = {
      escrowAccount: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(),
      },
    };
  });

  it('deve permitir HELD -> PARTIALLY_RELEASED -> RELEASED', () => {
    expect(service.canTransition(EscrowStatus.HELD, EscrowStatus.PARTIALLY_RELEASED)).toBe(true);
    expect(service.canTransition(EscrowStatus.PARTIALLY_RELEASED, EscrowStatus.RELEASED)).toBe(true);
  });

  it('deve considerar RELEASED, REFUNDED e CANCELLED terminais', () => {
    expect(service.isTerminal(EscrowStatus.RELEASED)).toBe(true);
    expect(service.isTerminal(EscrowStatus.REFUNDED)).toBe(true);
    expect(service.isTerminal(EscrowStatus.CANCELLED)).toBe(true);
  });

  it('deve bloquear regressão RELEASED -> HELD', () => {
    expect(service.canTransition(EscrowStatus.RELEASED, EscrowStatus.HELD)).toBe(false);
  });

  it('deve ser idempotente para o mesmo status', async () => {
    const escrow = { id: 'escrow-1', status: EscrowStatus.HELD };
    tx.escrowAccount.findUnique.mockResolvedValue(escrow);

    await expect(
      service.transition(tx as unknown as Prisma.TransactionClient, {
        escrowAccountId: 'escrow-1',
        toStatus: EscrowStatus.HELD,
      }),
    ).resolves.toBe(escrow);
    expect(tx.escrowAccount.updateMany).not.toHaveBeenCalled();
  });

  it('deve usar compare-and-set no status atual', async () => {
    tx.escrowAccount.findUnique.mockResolvedValue({
      id: 'escrow-1',
      status: EscrowStatus.HELD,
    });
    tx.escrowAccount.findUniqueOrThrow.mockResolvedValue({
      id: 'escrow-1',
      status: EscrowStatus.RELEASED,
    });

    await service.transition(tx as unknown as Prisma.TransactionClient, {
      escrowAccountId: 'escrow-1',
      toStatus: EscrowStatus.RELEASED,
    });

    expect(tx.escrowAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'escrow-1', status: EscrowStatus.HELD },
      data: { status: EscrowStatus.RELEASED },
    });
  });

  it('deve fazer claim atômico de saldos durante release', async () => {
    tx.escrowAccount.findUniqueOrThrow.mockResolvedValue({
      id: 'escrow-1',
      status: EscrowStatus.PARTIALLY_RELEASED,
      heldAmount: new Prisma.Decimal(60),
      releasedAmount: new Prisma.Decimal(40),
    });

    await service.transitionRelease(tx as unknown as Prisma.TransactionClient, {
      escrowAccountId: 'escrow-1',
      toStatus: EscrowStatus.PARTIALLY_RELEASED,
      expectedStatus: EscrowStatus.HELD,
      expectedHeldAmount: new Prisma.Decimal(100),
      expectedReleasedAmount: new Prisma.Decimal(0),
      releaseAmount: new Prisma.Decimal(40),
    });

    expect(tx.escrowAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'escrow-1',
        status: EscrowStatus.HELD,
        heldAmount: new Prisma.Decimal(100),
        releasedAmount: new Prisma.Decimal(0),
      },
      data: {
        status: EscrowStatus.PARTIALLY_RELEASED,
        heldAmount: { decrement: new Prisma.Decimal(40) },
        releasedAmount: { increment: new Prisma.Decimal(40) },
      },
    });
  });


  it('deve fazer claim atômico de saldos durante refund', async () => {
    tx.escrowAccount.findUniqueOrThrow.mockResolvedValue({
      id: 'escrow-1',
      status: EscrowStatus.REFUNDED,
      heldAmount: new Prisma.Decimal(0),
      refundedAmount: new Prisma.Decimal(100),
    });

    await service.transitionRefund(tx as unknown as Prisma.TransactionClient, {
      escrowAccountId: 'escrow-1',
      toStatus: EscrowStatus.REFUNDED,
      expectedStatus: EscrowStatus.HELD,
      expectedHeldAmount: new Prisma.Decimal(100),
      expectedRefundedAmount: new Prisma.Decimal(0),
      refundAmount: new Prisma.Decimal(100),
    });

    expect(tx.escrowAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'escrow-1',
        status: EscrowStatus.HELD,
        heldAmount: new Prisma.Decimal(100),
        refundedAmount: new Prisma.Decimal(0),
      },
      data: {
        status: EscrowStatus.REFUNDED,
        heldAmount: { decrement: new Prisma.Decimal(100) },
        refundedAmount: { increment: new Prisma.Decimal(100) },
      },
    });
  });

  it('deve retornar conflito quando outro worker vencer a transição', async () => {
    tx.escrowAccount.findUnique.mockResolvedValue({
      id: 'escrow-1',
      status: EscrowStatus.HELD,
    });
    tx.escrowAccount.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.transition(tx as unknown as Prisma.TransactionClient, {
        escrowAccountId: 'escrow-1',
        toStatus: EscrowStatus.RELEASED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deve retornar 404 para Escrow inexistente', async () => {
    tx.escrowAccount.findUnique.mockResolvedValue(null);

    await expect(
      service.transition(tx as unknown as Prisma.TransactionClient, {
        escrowAccountId: 'missing',
        toStatus: EscrowStatus.RELEASED,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
