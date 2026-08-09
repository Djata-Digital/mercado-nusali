import { ConflictException } from '@nestjs/common';
import { PayoutStatus, Prisma, SellerStatus } from '@prisma/client';

import { PayoutsService } from './payouts.service';

describe('PayoutsService - Sprint 7.3.4', () => {
  let tx: any;
  let prisma: any;
  let wallet: any;
  let transaction: any;
  let events: any;
  let reconciliation: any;
  let service: PayoutsService;

  beforeEach(() => {
    tx = {
      sellerProfile: { findUnique: jest.fn() },
      payout: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    prisma = {
      sellerProfile: { findUnique: jest.fn() },
      payout: { findMany: jest.fn() },
    };

    wallet = {
      reserveBalance: jest.fn(),
      releaseReservedBalance: jest.fn(),
      captureReservedPayoutInTransaction: jest.fn(),
    };

    transaction = {
      run: jest.fn((callback: any) => callback(tx)),
    };

    events = { enqueue: jest.fn() };
    reconciliation = {
      reconcileOne: jest.fn(),
      listInconsistent: jest.fn(),
    };

    service = new PayoutsService(
      prisma,
      wallet,
      transaction,
      events,
      reconciliation,
    );
  });

  it('deve criar payout e bloquear saldo na mesma transação', async () => {
    tx.sellerProfile.findUnique.mockResolvedValue({
      id: 'seller-1',
      userId: 'user-1',
      status: SellerStatus.VERIFIED,
    });
    tx.payout.create.mockResolvedValue({
      id: 'payout-1',
      sellerId: 'seller-1',
      amount: new Prisma.Decimal(100),
      currencyId: 'curr-1',
      status: PayoutStatus.CREATED,
    });

    const result = await service.requestPayout(
      'user-1',
      100,
      'curr-1',
    );

    expect(result.id).toBe('payout-1');
    expect(wallet.reserveBalance).toHaveBeenCalledWith(
      'user-1',
      expect.any(Prisma.Decimal),
      'curr-1',
      'Payout',
      'payout-1',
      expect.any(String),
      tx,
    );
    expect(events.enqueue).toHaveBeenCalledWith(
      tx,
      'payout-1',
      'payout.requested',
      expect.any(Object),
    );
  });

  it('deve fazer claim CREATED -> PROCESSING antes de capturar saldo', async () => {
    tx.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      sellerId: 'seller-1',
      seller: { userId: 'user-1' },
      amount: new Prisma.Decimal(100),
      currencyId: 'curr-1',
      status: PayoutStatus.CREATED,
    });
    tx.payout.updateMany.mockResolvedValue({ count: 1 });
    tx.payout.update.mockResolvedValue({
      id: 'payout-1',
      status: PayoutStatus.PAID,
    });

    await service.processPayout('payout-1');

    expect(tx.payout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payout-1', status: PayoutStatus.CREATED },
        data: { status: PayoutStatus.PROCESSING },
      }),
    );
    expect(wallet.captureReservedPayoutInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        payoutId: 'payout-1',
        userId: 'user-1',
      }),
    );
    expect(events.enqueue).toHaveBeenCalledWith(
      tx,
      'payout-1',
      'payout.paid',
      expect.any(Object),
    );
  });

  it('deve impedir segundo worker quando o CAS do payout falhar', async () => {
    tx.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      sellerId: 'seller-1',
      seller: { userId: 'user-1' },
      amount: new Prisma.Decimal(100),
      currencyId: 'curr-1',
      status: PayoutStatus.CREATED,
    });
    tx.payout.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processPayout('payout-1'))
      .rejects.toBeInstanceOf(ConflictException);

    expect(wallet.captureReservedPayoutInTransaction).not.toHaveBeenCalled();
  });

  it('deve tratar PAID como idempotente sem novo débito', async () => {
    const paid = {
      id: 'payout-1',
      sellerId: 'seller-1',
      seller: { userId: 'user-1' },
      amount: new Prisma.Decimal(100),
      currencyId: 'curr-1',
      status: PayoutStatus.PAID,
    };
    tx.payout.findUnique.mockResolvedValue(paid);

    await expect(service.processPayout('payout-1')).resolves.toBe(paid);
    expect(wallet.captureReservedPayoutInTransaction).not.toHaveBeenCalled();
  });

  it('deve cancelar CREATED e devolver saldo bloqueado', async () => {
    tx.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      sellerId: 'seller-1',
      seller: { userId: 'user-1' },
      amount: new Prisma.Decimal(100),
      currencyId: 'curr-1',
      status: PayoutStatus.CREATED,
    });
    tx.payout.updateMany.mockResolvedValue({ count: 1 });
    tx.payout.findUniqueOrThrow.mockResolvedValue({
      id: 'payout-1',
      status: PayoutStatus.CANCELLED,
    });

    await service.cancelPayout('user-1', 'payout-1');

    expect(wallet.releaseReservedBalance).toHaveBeenCalledWith(
      'user-1',
      expect.any(Prisma.Decimal),
      'curr-1',
      'Payout',
      'payout-1',
      expect.any(String),
      tx,
    );
    expect(events.enqueue).toHaveBeenCalledWith(
      tx,
      'payout-1',
      'payout.cancelled',
      expect.any(Object),
    );
  });

  it('deve marcar falha e devolver saldo bloqueado sem payout externo', async () => {
    tx.payout.findUnique.mockResolvedValue({
      id: 'payout-1',
      sellerId: 'seller-1',
      seller: { userId: 'user-1' },
      amount: new Prisma.Decimal(100),
      currencyId: 'curr-1',
      status: PayoutStatus.PROCESSING,
    });
    tx.payout.updateMany.mockResolvedValue({ count: 1 });
    tx.payout.findUniqueOrThrow.mockResolvedValue({
      id: 'payout-1',
      status: PayoutStatus.FAILED,
    });

    await service.failPayout('payout-1', 'timeout');

    expect(wallet.releaseReservedBalance).toHaveBeenCalledTimes(1);
    expect(events.enqueue).toHaveBeenCalledWith(
      tx,
      'payout-1',
      'payout.failed',
      expect.objectContaining({ reason: 'timeout' }),
    );
  });
});
