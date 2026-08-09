import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CartTransactionService } from './cart-transaction.service';

describe('CartTransactionService', () => {
  const transaction = jest.fn();
  const prisma = { $transaction: transaction } as any;

  let service: CartTransactionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CartTransactionService(prisma);
  });

  it('deve executar usando isolamento Serializable', async () => {
    transaction.mockImplementation(async (callback) => callback({ id: 'tx' }));

    const result = await service.run(async (tx: any) => tx.id);

    expect(result).toBe('tx');
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('deve repetir a operação após conflito transitório', async () => {
    transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback) => callback({ ok: true }));

    const result = await service.run(async (tx: any) => tx.ok);

    expect(result).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('deve transformar conflito persistente em erro estável 409', async () => {
    transaction.mockRejectedValue({ code: '40001' });

    await expect(
      service.run(async () => true, { maxRetries: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('deve propagar erros não transitórios sem repetir', async () => {
    const failure = new Error('outbox failure');
    transaction.mockRejectedValue(failure);

    await expect(service.run(async () => true)).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
