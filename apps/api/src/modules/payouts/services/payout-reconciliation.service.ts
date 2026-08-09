import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LedgerAccountType,
  PayoutStatus,
  Prisma,
  WalletTransactionType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export type PayoutReconciliationResult = {
  payoutId: string;
  status: PayoutStatus;
  consistent: boolean;
  issues: string[];
  reservationCount: number;
  payoutDebitCount: number;
  ledgerCount: number;
};

@Injectable()
export class PayoutReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcileOne(payoutId: string): Promise<PayoutReconciliationResult> {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: { seller: true },
    });

    if (!payout) {
      throw new NotFoundException('Solicitação de payout não encontrada.');
    }

    const [wallet, transactions, ledgerEntries] = await Promise.all([
      this.prisma.wallet.findUnique({
        where: { userId: payout.seller.userId },
      }),
      this.prisma.walletTransaction.findMany({
        where: {
          referenceType: 'Payout',
          referenceId: payout.id,
        },
      }),
      this.prisma.ledgerEntry.findMany({
        where: {
          referenceType: 'Payout',
          referenceId: payout.id,
        },
      }),
    ]);

    const reservationCount = transactions.filter(
      (item) => item.type === WalletTransactionType.ESCROW_HOLD,
    ).length;
    const payoutDebitCount = transactions.filter(
      (item) => item.type === WalletTransactionType.WITHDRAW,
    ).length;

    const validPayoutLedger = ledgerEntries.filter(
      (entry) =>
        entry.debitAccount === LedgerAccountType.SELLER_WALLET &&
        entry.creditAccount === LedgerAccountType.GATEWAY_CLEARING &&
        new Prisma.Decimal(entry.amount).eq(payout.amount),
    );

    const issues: string[] = [];

    if (!wallet) issues.push('SELLER_WALLET_NOT_FOUND');
    if (reservationCount !== 1) issues.push('INVALID_RESERVATION_COUNT');

    if (payout.status === PayoutStatus.PAID) {
      if (payoutDebitCount !== 1) issues.push('INVALID_PAYOUT_DEBIT_COUNT');
      if (validPayoutLedger.length !== 1) issues.push('INVALID_PAYOUT_LEDGER');
      if (!payout.processedAt) issues.push('PAID_WITHOUT_PROCESSED_AT');
    }

    if (
      payout.status === PayoutStatus.CREATED ||
      payout.status === PayoutStatus.PROCESSING
    ) {
      if (payoutDebitCount !== 0) issues.push('DEBIT_BEFORE_PAID');
      if (validPayoutLedger.length !== 0) issues.push('LEDGER_BEFORE_PAID');
    }

    if (
      payout.status === PayoutStatus.CANCELLED ||
      payout.status === PayoutStatus.FAILED
    ) {
      if (payoutDebitCount !== 0) issues.push('DEBIT_ON_TERMINAL_FAILURE');
      if (validPayoutLedger.length !== 0) issues.push('LEDGER_ON_TERMINAL_FAILURE');
    }

    return {
      payoutId: payout.id,
      status: payout.status,
      consistent: issues.length === 0,
      issues,
      reservationCount,
      payoutDebitCount,
      ledgerCount: validPayoutLedger.length,
    };
  }

  async listInconsistent(limit = 50) {
    const payouts = await this.prisma.payout.findMany({
      take: Math.min(Math.max(limit, 1), 200),
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    const results = await Promise.all(
      payouts.map((payout) => this.reconcileOne(payout.id)),
    );

    return results.filter((result) => !result.consistent);
  }
}
