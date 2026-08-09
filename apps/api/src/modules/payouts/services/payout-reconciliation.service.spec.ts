import {
  LedgerAccountType,
  PayoutStatus,
  Prisma,
  WalletTransactionType,
} from '@prisma/client';

import { PayoutReconciliationService } from './payout-reconciliation.service';

describe('PayoutReconciliationService - Sprint 7.3.4', () => {
  const payout = {
    id: 'payout-1',
    sellerId: 'seller-1',
    seller: { userId: 'user-1' },
    amount: new Prisma.Decimal(100),
    status: PayoutStatus.PAID,
    processedAt: new Date(),
  };

  function build() {
    const prisma: any = {
      payout: {
        findUnique: jest.fn().mockResolvedValue(payout),
        findMany: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
      },
      walletTransaction: {
        findMany: jest.fn().mockResolvedValue([
          { type: WalletTransactionType.ESCROW_HOLD },
          { type: WalletTransactionType.WITHDRAW },
        ]),
      },
      ledgerEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            debitAccount: LedgerAccountType.SELLER_WALLET,
            creditAccount: LedgerAccountType.GATEWAY_CLEARING,
            amount: new Prisma.Decimal(100),
          },
        ]),
      },
    };

    return {
      prisma,
      service: new PayoutReconciliationService(prisma),
    };
  }

  it('deve considerar PAID consistente quando Wallet e Ledger batem', async () => {
    const { service } = build();
    const result = await service.reconcileOne('payout-1');

    expect(result.consistent).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('deve detectar payout PAID sem Ledger correspondente', async () => {
    const { service, prisma } = build();
    prisma.ledgerEntry.findMany.mockResolvedValue([]);

    const result = await service.reconcileOne('payout-1');

    expect(result.consistent).toBe(false);
    expect(result.issues).toContain('INVALID_PAYOUT_LEDGER');
  });

  it('deve detectar débito duplicado de payout', async () => {
    const { service, prisma } = build();
    prisma.walletTransaction.findMany.mockResolvedValue([
      { type: WalletTransactionType.ESCROW_HOLD },
      { type: WalletTransactionType.WITHDRAW },
      { type: WalletTransactionType.WITHDRAW },
    ]);

    const result = await service.reconcileOne('payout-1');

    expect(result.consistent).toBe(false);
    expect(result.issues).toContain('INVALID_PAYOUT_DEBIT_COUNT');
  });
});
