import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, WalletStatus } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletTransactionService } from './services/wallet-transaction.service';
import { WalletService } from './wallet.service';

describe('WalletService - Sprint 7.3.2 reserved balance core', () => {
  const wallet = (available = 100, blocked = 0) => ({
    id: 'wallet-1', userId: 'user-1', currencyId: 'curr-1', status: WalletStatus.ACTIVE,
    balanceAvailable: new Prisma.Decimal(available), balanceBlocked: new Prisma.Decimal(blocked),
  });

  let tx: any;
  let prisma: any;
  let ledger: any;
  let service: WalletService;

  beforeEach(() => {
    tx = {
      wallet: {
        findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn(),
      },
      walletTransaction: { create: jest.fn() },
      currency: { findFirst: jest.fn() },
    };
    prisma = { $transaction: jest.fn((cb: any) => cb(tx)) };
    ledger = { createDoubleEntry: jest.fn() };
    const transactionService = new WalletTransactionService(prisma as PrismaService);
    service = new WalletService(
      prisma as PrismaService,
      ledger as LedgerService,
      { emit: jest.fn() } as unknown as EventEmitter2,
      transactionService,
    );
  });

  it('deve reservar saldo movendo available -> blocked atomicamente', async () => {
    tx.wallet.findUnique.mockResolvedValue(wallet(100, 20));
    tx.wallet.updateMany.mockResolvedValue({ count: 1 });
    tx.wallet.findUniqueOrThrow.mockResolvedValue(wallet(70, 50));
    tx.walletTransaction.create.mockResolvedValue({ id: 'wt-reserve' });

    const result = await service.reserveBalance('user-1', 30, 'curr-1', 'Order', 'order-1');

    expect(tx.wallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ balanceAvailable: new Prisma.Decimal(100), balanceBlocked: new Prisma.Decimal(20) }),
      data: { balanceAvailable: { decrement: new Prisma.Decimal(30) }, balanceBlocked: { increment: new Prisma.Decimal(30) } },
    }));
    expect(result.wallet.balanceAvailable.eq(70)).toBe(true);
    expect(result.wallet.balanceBlocked.eq(50)).toBe(true);
    expect(ledger.createDoubleEntry).not.toHaveBeenCalled();
  });

  it('deve impedir reserva maior que saldo disponível', async () => {
    tx.wallet.findUnique.mockResolvedValue(wallet(20, 0));
    await expect(service.reserveBalance('user-1', 30, 'curr-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('deve desbloquear saldo movendo blocked -> available', async () => {
    tx.wallet.findUnique.mockResolvedValue(wallet(40, 60));
    tx.wallet.updateMany.mockResolvedValue({ count: 1 });
    tx.wallet.findUniqueOrThrow.mockResolvedValue(wallet(65, 35));
    tx.walletTransaction.create.mockResolvedValue({ id: 'wt-release' });

    const result = await service.releaseReservedBalance('user-1', 25, 'curr-1');
    expect(result.wallet.balanceAvailable.eq(65)).toBe(true);
    expect(result.wallet.balanceBlocked.eq(35)).toBe(true);
  });

  it('deve impedir desbloqueio maior que saldo bloqueado', async () => {
    tx.wallet.findUnique.mockResolvedValue(wallet(90, 10));
    await expect(service.releaseReservedBalance('user-1', 11, 'curr-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve capturar somente saldo bloqueado e registrar Ledger no mesmo tx', async () => {
    tx.wallet.findUnique.mockResolvedValue(wallet(40, 60));
    tx.wallet.updateMany.mockResolvedValue({ count: 1 });
    tx.wallet.findUniqueOrThrow.mockResolvedValue(wallet(40, 20));
    tx.walletTransaction.create.mockResolvedValue({ id: 'wt-capture' });

    const result = await service.captureReservedBalance('user-1', 40, 'curr-1', 'Order', 'order-1');
    expect(result.wallet.balanceAvailable.eq(40)).toBe(true);
    expect(result.wallet.balanceBlocked.eq(20)).toBe(true);
    expect(ledger.createDoubleEntry).toHaveBeenCalledTimes(1);
    expect(ledger.createDoubleEntry.mock.calls[0][1]).toBe(tx);
  });

  it('deve impedir captura maior que saldo bloqueado', async () => {
    tx.wallet.findUnique.mockResolvedValue(wallet(80, 20));
    await expect(service.captureReservedBalance('user-1', 21, 'curr-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve detectar worker concorrente no CAS de reserva', async () => {
    tx.wallet.findUnique.mockResolvedValue(wallet(100, 0));
    tx.wallet.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.reserveBalance('user-1', 50, 'curr-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('deve reutilizar TransactionClient externo sem abrir transação aninhada', async () => {
    tx.wallet.findUnique.mockResolvedValue(wallet(100, 0));
    tx.wallet.updateMany.mockResolvedValue({ count: 1 });
    tx.wallet.findUniqueOrThrow.mockResolvedValue(wallet(90, 10));
    tx.walletTransaction.create.mockResolvedValue({ id: 'wt-reserve' });

    await service.reserveBalance('user-1', 10, 'curr-1', undefined, undefined, undefined, tx);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
