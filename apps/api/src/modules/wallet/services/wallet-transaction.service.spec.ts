import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WalletTransactionService } from './wallet-transaction.service';

describe('WalletTransactionService - Sprint 7.3.1', () => {
  let service: WalletTransactionService;
  let prisma: { $transaction: jest.Mock };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (callback, options) =>
        callback({ options } as unknown as Prisma.TransactionClient),
      ),
    };
    service = new WalletTransactionService(prisma as unknown as PrismaService);
  });

  it('deve executar mutações financeiras com isolamento Serializable', async () => {
    await expect(service.run(async () => 'ok')).resolves.toBe('ok');

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('deve repetir P2034 transitório', async () => {
    prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback) => callback({}));

    await expect(service.run(async () => 'ok')).resolves.toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('deve repetir serialização PostgreSQL 40001', async () => {
    prisma.$transaction
      .mockRejectedValueOnce({ code: '40001' })
      .mockImplementationOnce(async (callback) => callback({}));

    await expect(service.run(async () => 'ok')).resolves.toBe('ok');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('não deve repetir P2002 automaticamente', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });

    await expect(service.run(async () => 'ok')).rejects.toEqual({ code: 'P2002' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('deve converter conflito persistente em 409 estável', async () => {
    prisma.$transaction.mockRejectedValue({ code: 'P2034' });

    await expect(
      service.run(async () => 'ok', { maxRetries: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
