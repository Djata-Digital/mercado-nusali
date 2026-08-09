import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentTransactionService } from './payment-transaction.service';

describe('PaymentTransactionService', () => {
  const prisma = {
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  let service: PaymentTransactionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentTransactionService(prisma);
  });

  it('deve executar operações financeiras com isolamento Serializable', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({ id: 'tx' }),
    );

    await expect(service.run(async () => 'ok')).resolves.toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('deve repetir conflito P2034 transitório', async () => {
    (prisma.$transaction as jest.Mock)
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback) => callback({}));

    await expect(service.run(async () => 'ok')).resolves.toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('deve repetir serialização PostgreSQL 40001', async () => {
    (prisma.$transaction as jest.Mock)
      .mockRejectedValueOnce({ code: '40001' })
      .mockImplementationOnce(async (callback) => callback({}));

    await expect(service.run(async () => 'ok')).resolves.toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('não deve repetir P2002 automaticamente', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2002' });

    await expect(service.run(async () => 'never')).rejects.toEqual({
      code: 'P2002',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('deve converter conflito persistente em erro estável 409', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2034' });

    await expect(service.run(async () => 'never')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('deve propagar erro não transitório sem retry', async () => {
    const error = new Error('provider failed');
    (prisma.$transaction as jest.Mock).mockRejectedValue(error);

    await expect(service.run(async () => 'never')).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
