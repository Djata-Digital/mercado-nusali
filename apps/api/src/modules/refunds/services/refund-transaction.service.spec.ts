import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RefundTransactionService } from './refund-transaction.service';

describe('RefundTransactionService - Sprint 7.4.1', () => {
  it('deve executar refunds com isolamento Serializable', async () => {
    const prisma: any = { $transaction: jest.fn(async (fn: any, options: any) => fn({ marker: true })) };
    const service = new RefundTransactionService(prisma);
    const result = await service.run(async (tx: any) => tx.marker);
    expect(result).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('deve repetir conflito P2034 transitório', async () => {
    let calls = 0;
    const prisma: any = {
      $transaction: jest.fn(async (fn: any) => {
        calls += 1;
        if (calls === 1) throw { code: 'P2034' };
        return fn({ ok: true });
      }),
    };
    const service = new RefundTransactionService(prisma);
    await expect(service.run(async (tx: any) => tx.ok)).resolves.toBe(true);
    expect(calls).toBe(2);
  });

  it('deve converter conflito persistente em 409 estável', async () => {
    const prisma: any = { $transaction: jest.fn(async () => { throw { code: '40001' }; }) };
    const service = new RefundTransactionService(prisma);
    await expect(service.run(async () => true, 2)).rejects.toBeInstanceOf(ConflictException);
  });

  it('não deve repetir erro de negócio não transacional', async () => {
    const error = new Error('provider failure');
    const prisma: any = { $transaction: jest.fn(async () => { throw error; }) };
    const service = new RefundTransactionService(prisma);
    await expect(service.run(async () => true)).rejects.toBe(error);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
