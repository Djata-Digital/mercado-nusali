import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, PayoutStatus, Prisma, RefundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type FinancialReconciliationIssueCode =
  | 'REFUND_EXCEEDS_PAYMENT'
  | 'REFUNDED_PAYMENT_AMOUNT_MISMATCH'
  | 'PARTIAL_REFUND_STATUS_MISMATCH'
  | 'ESCROW_INVARIANT_BROKEN'
  | 'ESCROW_EXCEEDS_PAYMENT'
  | 'PAYOUT_EXCEEDS_RELEASED'
  | 'REFUND_LEDGER_MISMATCH'
  | 'PAYOUT_LEDGER_MISMATCH';

export interface FinancialReconciliationIssue {
  code: FinancialReconciliationIssueCode;
  severity: 'ERROR' | 'WARNING';
  message: string;
  expected?: string;
  actual?: string;
  referenceId?: string;
}

export interface FinancialPaymentReconciliationResult {
  paymentId: string;
  orderGroupId: string;
  currencyId: string;
  status: PaymentStatus;
  healthy: boolean;
  totals: {
    payment: string;
    refunded: string;
    escrow: string;
    released: string;
    payoutPaid: string;
    refundLedger: string;
    payoutLedger: string;
  };
  issues: FinancialReconciliationIssue[];
}

type ReconciliationLedgerEntry = {
  amount: Prisma.Decimal;
  referenceId: string | null;
};

@Injectable()
export class FinancialReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcilePayment(
    paymentId: string,
  ): Promise<FinancialPaymentReconciliationResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        orderGroupId: true,
        amount: true,
        currencyId: true,
        status: true,
        refunds: {
          where: { status: RefundStatus.COMPLETED },
          select: { id: true, amount: true, status: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Pagamento não encontrado.');
    }

    const escrows = await this.prisma.escrowAccount.findMany({
      where: { orderGroupId: payment.orderGroupId },
      select: {
        id: true,
        totalAmount: true,
        heldAmount: true,
        releasedAmount: true,
        refundedAmount: true,
        payoutItems: {
          where: { payout: { status: PayoutStatus.PAID } },
          select: { amount: true, payoutId: true },
        },
      },
    });

    const refundIds = payment.refunds.map((refund) => refund.id);
    const payoutIds = Array.from(
      new Set(escrows.flatMap((escrow) => escrow.payoutItems.map((item) => item.payoutId))),
    );

    const refundLedger: ReconciliationLedgerEntry[] = refundIds.length
      ? await this.prisma.ledgerEntry.findMany({
          where: {
            referenceType: 'REFUND',
            referenceId: { in: refundIds },
          },
          select: { amount: true, referenceId: true },
        })
      : [];

    const payoutLedger: ReconciliationLedgerEntry[] = payoutIds.length
      ? await this.prisma.ledgerEntry.findMany({
          where: {
            referenceType: 'PAYOUT',
            referenceId: { in: payoutIds },
          },
          select: { amount: true, referenceId: true },
        })
      : [];

    const zero = new Prisma.Decimal(0);
    const paymentAmount = new Prisma.Decimal(payment.amount);
    const refunded = payment.refunds.reduce(
      (sum, refund) => sum.add(refund.amount),
      zero,
    );
    const escrowTotal = escrows.reduce(
      (sum, escrow) => sum.add(escrow.totalAmount),
      zero,
    );
    const released = escrows.reduce(
      (sum, escrow) => sum.add(escrow.releasedAmount),
      zero,
    );
    const payoutPaid = escrows.reduce(
      (sum, escrow) =>
        sum.add(
          escrow.payoutItems.reduce(
            (inner, item) => inner.add(item.amount),
            zero,
          ),
        ),
      zero,
    );
    const refundLedgerTotal = refundLedger.reduce<Prisma.Decimal>(
      (sum, entry) => sum.add(entry.amount),
      new Prisma.Decimal(0),
    );
    const payoutLedgerTotal = payoutLedger.reduce<Prisma.Decimal>(
      (sum, entry) => sum.add(entry.amount),
      new Prisma.Decimal(0),
    );

    const issues: FinancialReconciliationIssue[] = [];

    if (refunded.gt(paymentAmount)) {
      issues.push({
        code: 'REFUND_EXCEEDS_PAYMENT',
        severity: 'ERROR',
        message: 'O total reembolsado excede o valor do pagamento.',
        expected: paymentAmount.toFixed(2),
        actual: refunded.toFixed(2),
        referenceId: payment.id,
      });
    }

    if (payment.status === PaymentStatus.REFUNDED && !refunded.eq(paymentAmount)) {
      issues.push({
        code: 'REFUNDED_PAYMENT_AMOUNT_MISMATCH',
        severity: 'ERROR',
        message: 'Payment REFUNDED não possui reembolso COMPLETED integral.',
        expected: paymentAmount.toFixed(2),
        actual: refunded.toFixed(2),
        referenceId: payment.id,
      });
    }

    if (
      payment.status === PaymentStatus.PARTIALLY_REFUNDED &&
      (refunded.lte(0) || refunded.gte(paymentAmount))
    ) {
      issues.push({
        code: 'PARTIAL_REFUND_STATUS_MISMATCH',
        severity: 'ERROR',
        message: 'Payment PARTIALLY_REFUNDED possui total reembolsado incompatível.',
        expected: `> 0.00 e < ${paymentAmount.toFixed(2)}`,
        actual: refunded.toFixed(2),
        referenceId: payment.id,
      });
    }

    for (const escrow of escrows) {
      const accounted = new Prisma.Decimal(escrow.heldAmount)
        .add(escrow.releasedAmount)
        .add(escrow.refundedAmount);

      if (!accounted.eq(escrow.totalAmount)) {
        issues.push({
          code: 'ESCROW_INVARIANT_BROKEN',
          severity: 'ERROR',
          message: 'Escrow viola held + released + refunded = totalAmount.',
          expected: new Prisma.Decimal(escrow.totalAmount).toFixed(2),
          actual: accounted.toFixed(2),
          referenceId: escrow.id,
        });
      }

      const escrowPayoutPaid = escrow.payoutItems.reduce(
        (sum, item) => sum.add(item.amount),
        zero,
      );
      if (escrowPayoutPaid.gt(escrow.releasedAmount)) {
        issues.push({
          code: 'PAYOUT_EXCEEDS_RELEASED',
          severity: 'ERROR',
          message: 'Payout PAID excede o valor liberado do Escrow.',
          expected: new Prisma.Decimal(escrow.releasedAmount).toFixed(2),
          actual: escrowPayoutPaid.toFixed(2),
          referenceId: escrow.id,
        });
      }
    }

    if (escrowTotal.gt(paymentAmount)) {
      issues.push({
        code: 'ESCROW_EXCEEDS_PAYMENT',
        severity: 'ERROR',
        message: 'A soma dos Escrows do OrderGroup excede o Payment.',
        expected: paymentAmount.toFixed(2),
        actual: escrowTotal.toFixed(2),
        referenceId: payment.orderGroupId,
      });
    }

    if (refundLedger.length > 0 && refundLedgerTotal.lt(refunded)) {
      issues.push({
        code: 'REFUND_LEDGER_MISMATCH',
        severity: 'ERROR',
        message: 'Ledger de Refund está abaixo do total de Refund COMPLETED.',
        expected: refunded.toFixed(2),
        actual: refundLedgerTotal.toFixed(2),
        referenceId: payment.id,
      });
    }

    if (payoutLedger.length > 0 && payoutLedgerTotal.lt(payoutPaid)) {
      issues.push({
        code: 'PAYOUT_LEDGER_MISMATCH',
        severity: 'ERROR',
        message: 'Ledger de Payout está abaixo do total de Payout PAID.',
        expected: payoutPaid.toFixed(2),
        actual: payoutLedgerTotal.toFixed(2),
        referenceId: payment.orderGroupId,
      });
    }

    return {
      paymentId: payment.id,
      orderGroupId: payment.orderGroupId,
      currencyId: payment.currencyId,
      status: payment.status,
      healthy: issues.length === 0,
      totals: {
        payment: paymentAmount.toFixed(2),
        refunded: refunded.toFixed(2),
        escrow: escrowTotal.toFixed(2),
        released: released.toFixed(2),
        payoutPaid: payoutPaid.toFixed(2),
        refundLedger: refundLedgerTotal.toFixed(2),
        payoutLedger: payoutLedgerTotal.toFixed(2),
      },
      issues,
    };
  }

  async reconcileOrderGroup(orderGroupId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { orderGroupId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (payments.length === 0) {
      throw new NotFoundException('Nenhum pagamento encontrado para o OrderGroup.');
    }

    const results: FinancialPaymentReconciliationResult[] = [];
    for (const payment of payments) {
      results.push(await this.reconcilePayment(payment.id));
    }

    return {
      orderGroupId,
      healthy: results.every((result) => result.healthy),
      payments: results,
      issueCount: results.reduce((sum, result) => sum + result.issues.length, 0),
    };
  }
}
