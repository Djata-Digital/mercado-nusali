import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, WalletStatus } from '@prisma/client';

import { WalletService } from './wallet.service';

describe('WalletService - Sprint 7.3.1 atomic balance core', () => {
  const currencyId = 'currency-1';
  const userId = 'user-1';

  function wallet(balance = '100.00') {
    return {
      id: 'wallet-1',
      userId,
      currencyId,
      status: WalletStatus.ACTIVE,
      balanceAvailable: new Prisma.Decimal(balance),
      balanceBlocked: new Prisma.Decimal(0),
    };
  }

  function build() {
    const tx = {
      wallet: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      currency: { findFirst: jest.fn() },
      walletTransaction: { create: jest.fn() },
    };

    const prisma = {
      wallet: { findUnique: jest.fn(), create: jest.fn() },
      currency: { findFirst: jest.fn() },
      walletTransaction: { findMany: jest.fn() },
    };

    const ledger = { createDoubleEntry: jest.fn().mockResolvedValue({ id: 'ledger-1' }) };
    const emitter = { emit: jest.fn() };
    const transaction = {
      run: jest.fn(async (operation) => operation(tx)),
    };

    const service = new WalletService(
      prisma as any,
      ledger as any,
      emitter as any,
      transaction as any,
    );

    return { service, prisma, tx, ledger, emitter, transaction };
  }

  it('deve usar WalletTransactionService para depósito iniciado pela própria Wallet', async () => {
    const { service, tx, transaction, emitter } = build();

    tx.wallet.findUnique.mockResolvedValue(wallet('10.00'));
    tx.wallet.updateMany.mockResolvedValue({ count: 1 });
    tx.wallet.findUniqueOrThrow.mockResolvedValue(wallet('35.00'));
    tx.walletTransaction.create.mockResolvedValue({ id: 'wt-1' });

    await service.deposit(userId, 25, currencyId);

    expect(transaction.run).toHaveBeenCalledTimes(1);
    expect(tx.wallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          balanceAvailable: expect.any(Prisma.Decimal),
        }),
        data: { balanceAvailable: { increment: new Prisma.Decimal(25) } },
      }),
    );
    expect(emitter.emit).toHaveBeenCalledTimes(1);
  });

  it('deve reutilizar TransactionClient externo sem abrir transação aninhada', async () => {
    const { service, tx, transaction, emitter } = build();

    tx.wallet.findUnique.mockResolvedValue(wallet('0.00'));
    tx.wallet.updateMany.mockResolvedValue({ count: 1 });
    tx.wallet.findUniqueOrThrow.mockResolvedValue(wallet('100.00'));
    tx.walletTransaction.create.mockResolvedValue({ id: 'wt-refund' });

    await service.deposit(
      userId,
      new Prisma.Decimal('100.00'),
      currencyId,
      'Refund Escrow',
      tx as any,
    );

    expect(transaction.run).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('deve impedir saldo negativo antes de tentar o CAS', async () => {
    const { service, tx } = build();

    tx.wallet.findUnique.mockResolvedValue(wallet('40.00'));

    await expect(service.withdraw(userId, 50, currencyId, undefined, tx as any))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('deve detectar concorrência quando o saldo mudou antes do update', async () => {
    const { service, tx } = build();

    tx.wallet.findUnique.mockResolvedValue(wallet('100.00'));
    tx.wallet.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.withdraw(userId, 30, currencyId, undefined, tx as any))
      .rejects.toBeInstanceOf(ConflictException);

    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('deve registrar saque e Ledger usando o mesmo TransactionClient', async () => {
    const { service, tx, ledger } = build();

    tx.wallet.findUnique.mockResolvedValue(wallet('100.00'));
    tx.wallet.updateMany.mockResolvedValue({ count: 1 });
    tx.wallet.findUniqueOrThrow.mockResolvedValue(wallet('70.00'));
    tx.walletTransaction.create.mockResolvedValue({ id: 'wt-withdraw' });

    await service.withdraw(userId, 30, currencyId, 'saque', tx as any);

    expect(tx.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balanceBefore: expect.any(Prisma.Decimal),
          balanceAfter: expect.any(Prisma.Decimal),
        }),
      }),
    );
    expect(ledger.createDoubleEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: expect.any(Prisma.Decimal),
        referenceType: 'WalletTransaction',
        referenceId: 'wt-withdraw',
      }),
      tx,
    );
  });

  it('deve rejeitar operação em moeda diferente da Wallet', async () => {
    const { service, tx } = build();

    tx.wallet.findUnique.mockResolvedValue(wallet('100.00'));

    await expect(
      service.withdraw(userId, 10, 'currency-other', undefined, tx as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });
});
