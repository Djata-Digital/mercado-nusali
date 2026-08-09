import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutTransactionService } from './checkout-transaction.service';

describe('CheckoutTransactionService', () => {
  const prisma = {
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  let service: CheckoutTransactionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckoutTransactionService(prisma);
  });

  it('deve executar com isolamento Serializable', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({ id: 'tx' }),
    );

    const result = await service.run(async () => 'ok');

    expect(result).toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('deve repetir conflito transitório', async () => {
    (prisma.$transaction as jest.Mock)
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback) => callback({}));

    await expect(service.run(async () => 'ok')).resolves.toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('deve retornar erro estável após conflito persistente', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: '40001' });

    await expect(service.run(async () => 'never')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
