import { ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';

import { PaymentStateMachineService } from './payment-state-machine.service';

describe('PaymentStateMachineService', () => {
  let service: PaymentStateMachineService;

  beforeEach(() => {
    service = new PaymentStateMachineService();
  });

  it('deve permitir o fluxo PENDING -> AUTHORIZED -> CAPTURED', () => {
    expect(
      service.canTransition(PaymentStatus.PENDING, PaymentStatus.AUTHORIZED),
    ).toBe(true);
    expect(
      service.canTransition(PaymentStatus.AUTHORIZED, PaymentStatus.CAPTURED),
    ).toBe(true);
  });

  it('deve permitir claim AUTHORIZED -> PROCESSING antes de chamar o provider', () => {
    expect(
      service.canTransition(PaymentStatus.AUTHORIZED, PaymentStatus.PROCESSING),
    ).toBe(true);
  });

  it('deve permitir captura instantânea PENDING -> CAPTURED', () => {
    expect(
      service.canTransition(PaymentStatus.PENDING, PaymentStatus.CAPTURED),
    ).toBe(true);
  });

  it('deve bloquear regressão CAPTURED -> PENDING', () => {
    expect(() =>
      service.assertTransition(PaymentStatus.CAPTURED, PaymentStatus.PENDING),
    ).toThrow(ConflictException);
  });

  it('deve considerar REFUNDED terminal', () => {
    expect(service.isTerminal(PaymentStatus.REFUNDED)).toBe(true);
    expect(
      service.canTransition(PaymentStatus.REFUNDED, PaymentStatus.CAPTURED),
    ).toBe(false);
  });

  it('deve ser idempotente quando o pagamento já está no status solicitado', async () => {
    const payment = { id: 'payment-1', status: PaymentStatus.CAPTURED };
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      paymentEvent: { create: jest.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      service.transition(tx, {
        paymentId: payment.id,
        toStatus: PaymentStatus.CAPTURED,
      }),
    ).resolves.toEqual(payment);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.paymentEvent.create).not.toHaveBeenCalled();
  });

  it('deve atualizar status e PaymentEvent no mesmo TransactionClient', async () => {
    const before = { id: 'payment-1', status: PaymentStatus.PENDING };
    const after = { id: 'payment-1', status: PaymentStatus.AUTHORIZED };
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(before),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(after),
      },
      paymentEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    } as unknown as Prisma.TransactionClient;

    const result = await service.transition(tx, {
      paymentId: before.id,
      toStatus: PaymentStatus.AUTHORIZED,
      payload: { source: 'provider' },
    });

    expect(result).toEqual(after);
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: before.id, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.AUTHORIZED },
    });
    expect(tx.paymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: before.id,
          previousStatus: PaymentStatus.PENDING,
          newStatus: PaymentStatus.AUTHORIZED,
        }),
      }),
    );
  });

  it('deve retornar conflito quando outro worker alterar o status', async () => {
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-1',
          status: PaymentStatus.PENDING,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      paymentEvent: { create: jest.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      service.transition(tx, {
        paymentId: 'payment-1',
        toStatus: PaymentStatus.AUTHORIZED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.paymentEvent.create).not.toHaveBeenCalled();
  });

  it('deve retornar 404 para pagamento inexistente', async () => {
    const tx = {
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as Prisma.TransactionClient;

    await expect(
      service.transition(tx, {
        paymentId: 'missing',
        toStatus: PaymentStatus.PENDING,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
