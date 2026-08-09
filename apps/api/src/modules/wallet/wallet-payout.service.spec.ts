import { BadRequestException, ConflictException } from '@nestjs/common';
import { LedgerAccountType, Prisma, WalletStatus } from '@prisma/client';

import { WalletService } from './wallet.service';

describe('WalletService - Sprint 7.3.4 payout capture', () => {
  function build(blocked = '100.00') {
    const tx: any = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          userId: 'user-1',
          currencyId: 'curr-1',
          status: WalletStatus.ACTIVE,
          balanceAvailable: new Prisma.Decimal(20),
          balanceBlocked: new Prisma.Decimal(blocked),
        }),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
      },
      walletTransaction: { create: jest.fn() },
      currency: { findFirst: jest.fn() },
    };

    const ledger = { createDoubleEntry: jest.fn() };
    const service = new WalletService(
      {} as any,
      ledger as any,
      { emit: jest.fn() } as any,
      { run: jest.fn() } as any,
    );

    return { tx, ledger, service };
  }

  it('deve debitar somente balanceBlocked e gerar SELLER_WALLET -> GATEWAY_CLEARING', async () => {
    const { tx, ledger, service } = build();
    tx.wallet.updateMany.mockResolvedValue({ count: 1 });
    tx.wallet.findUniqueOrThrow.mockResolvedValue({
      id: 'wallet-1',
      balanceAvailable: new Prisma.Decimal(20),
      balanceBlocked: new Prisma.Decimal(0),
    });
    tx.walletTransaction.create.mockResolvedValue({ id: 'wt-1' });

    await service.captureReservedPayoutInTransaction(tx, {
      userId: 'user-1',
      amount: '100',
      currencyId: 'curr-1',
      payoutId: 'payout-1',
    });

    expect(ledger.createDoubleEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        debitAccount: LedgerAccountType.SELLER_WALLET,
        creditAccount: LedgerAccountType.GATEWAY_CLEARING,
        referenceType: 'Payout',
        referenceId: 'payout-1',
      }),
      tx,
    );
  });

  it('deve rejeitar payout maior que saldo bloqueado', async () => {
    const { tx, service } = build('50');

    await expect(
      service.captureReservedPayoutInTransaction(tx, {
        userId: 'user-1',
        amount: '100',
        currencyId: 'curr-1',
        payoutId: 'payout-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('deve detectar conflito CAS na captura do payout', async () => {
    const { tx, service } = build();
    tx.wallet.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.captureReservedPayoutInTransaction(tx, {
        userId: 'user-1',
        amount: '100',
        currencyId: 'curr-1',
        payoutId: 'payout-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
