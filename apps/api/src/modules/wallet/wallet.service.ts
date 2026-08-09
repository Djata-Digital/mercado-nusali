import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerAccountType,
  Prisma,
  WalletStatus,
  WalletTransactionType,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletTransactionService } from './services/wallet-transaction.service';

type FinancialTx = Prisma.TransactionClient;

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly eventEmitter: EventEmitter2,
    private readonly walletTransactionService: WalletTransactionService =
      new WalletTransactionService(prisma),
  ) {}

  async getOrCreateWallet(userId: string, preferredCurrencyId?: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { currency: true },
    });

    if (!wallet) {
      let currencyId = preferredCurrencyId;
      if (!currencyId) {
        const defaultCurrency = await this.prisma.currency.findFirst();
        if (!defaultCurrency) {
          throw new NotFoundException('Nenhuma moeda configurada no sistema.');
        }
        currencyId = defaultCurrency.id;
      }

      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          currencyId,
          balanceAvailable: new Prisma.Decimal(0),
          balanceBlocked: new Prisma.Decimal(0),
          status: WalletStatus.ACTIVE,
        },
        include: { currency: true },
      });
    }

    return wallet;
  }

  async getWalletBalance(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);

    return {
      walletId: wallet.id,
      userId: wallet.userId,
      balanceAvailable: wallet.balanceAvailable.toFixed(2),
      balanceBlocked: wallet.balanceBlocked.toFixed(2),
      totalBalance: wallet.balanceAvailable.add(wallet.balanceBlocked).toFixed(2),
      currency: wallet.currency,
      status: wallet.status,
    };
  }

  async deposit(
    userId: string,
    amount: Prisma.Decimal | number,
    currencyId: string,
    description?: string,
    txPrisma?: FinancialTx,
  ) {
    const amountDec = this.assertPositiveAmount(amount, 'depósito');

    const operation = (tx: FinancialTx) =>
      this.depositInTx(tx, userId, amountDec, currencyId, description);

    // Quando já existe TransactionClient (Escrow/Refund/Payment), reutilizamos
    // exatamente a transação do chamador e NÃO abrimos transação aninhada.
    const result = txPrisma
      ? await operation(txPrisma)
      : await this.walletTransactionService.run(operation);

    // Em transação externa o chamador ainda pode sofrer rollback. Evitamos
    // publicar um evento em memória antes do commit real.
    if (!txPrisma) {
      this.eventEmitter.emit('wallet.updated', {
        userId,
        type: 'DEPOSIT',
        amount: amountDec,
      });
    }

    return result;
  }

  async withdraw(
    userId: string,
    amount: Prisma.Decimal | number,
    currencyId: string,
    description?: string,
    txPrisma?: FinancialTx,
  ) {
    const amountDec = this.assertPositiveAmount(amount, 'saque');

    const operation = (tx: FinancialTx) =>
      this.withdrawInTx(tx, userId, amountDec, currencyId, description);

    const result = txPrisma
      ? await operation(txPrisma)
      : await this.walletTransactionService.run(operation);

    if (!txPrisma) {
      this.eventEmitter.emit('wallet.updated', {
        userId,
        type: 'WITHDRAW',
        amount: amountDec,
      });
    }

    return result;
  }

  /**
   * Credita uma liberação de Escrow usando exatamente o TransactionClient
   * do agregado Escrow. Não cria Ledger aqui, pois o Escrow registra
   * Wallet + Ledger + Outbox no mesmo commit.
   */
  async creditEscrowReleaseInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amount: Prisma.Decimal | number | string;
      currencyId: string;
      escrowAccountId: string;
      orderId: string;
    },
  ) {
    const amount = this.assertPositiveAmount(
      new Prisma.Decimal(input.amount),
      'liberação de Escrow',
    );

    const wallet = await this.getOrCreateWalletInTx(
      tx,
      input.userId,
      input.currencyId,
    );

    this.assertWalletCanMoveMoney(wallet, input.currencyId);

    const balanceBefore = new Prisma.Decimal(wallet.balanceAvailable);
    const balanceAfter = balanceBefore.add(amount);

    const claimed = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        status: WalletStatus.ACTIVE,
        currencyId: input.currencyId,
        balanceAvailable: balanceBefore,
      },
      data: { balanceAvailable: { increment: amount } },
    });

    if (claimed.count !== 1) {
      throw this.concurrentModification();
    }

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.ESCROW_RELEASE,
        amount,
        balanceBefore,
        balanceAfter,
        referenceType: 'EscrowAccount',
        referenceId: input.escrowAccountId,
        description: `Liberação de custódia do pedido ${input.orderId}`,
      },
    });

    return {
      wallet: { ...wallet, balanceAvailable: balanceAfter },
      transaction,
      balanceBefore,
      balanceAfter,
    };
  }

  /**
   * Credita um refund de Escrow ao comprador usando o TransactionClient
   * do chamador e preservando o CAS do saldo da Wallet.
   */
  async creditEscrowRefundInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amount: Prisma.Decimal | number | string;
      currencyId: string;
      escrowAccountId: string;
      orderId: string;
    },
  ) {
    const amount = this.assertPositiveAmount(
      new Prisma.Decimal(input.amount),
      'reembolso de Escrow',
    );

    const wallet = await this.getOrCreateWalletInTx(
      tx,
      input.userId,
      input.currencyId,
    );

    this.assertWalletCanMoveMoney(wallet, input.currencyId);

    const balanceBefore = new Prisma.Decimal(wallet.balanceAvailable);
    const balanceAfter = balanceBefore.add(amount);

    const claimed = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        status: WalletStatus.ACTIVE,
        currencyId: input.currencyId,
        balanceAvailable: balanceBefore,
      },
      data: { balanceAvailable: { increment: amount } },
    });

    if (claimed.count !== 1) {
      throw this.concurrentModification();
    }

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.REFUND,
        amount,
        balanceBefore,
        balanceAfter,
        referenceType: 'EscrowAccount',
        referenceId: input.escrowAccountId,
        description: `Reembolso de custódia do pedido ${input.orderId}`,
      },
    });

    return {
      wallet: { ...wallet, balanceAvailable: balanceAfter },
      transaction,
      balanceBefore,
      balanceAfter,
    };
  }

  /** Sprint 7.3.2: move saldo disponível -> bloqueado de forma atômica. */
  async reserveBalance(
    userId: string,
    amount: Prisma.Decimal | number,
    currencyId: string,
    referenceType?: string,
    referenceId?: string,
    description?: string,
    txPrisma?: FinancialTx,
  ) {
    const amountDec = this.assertPositiveAmount(amount, 'bloqueio');
    const operation = (tx: FinancialTx) =>
      this.reserveBalanceInTx(
        tx,
        userId,
        amountDec,
        currencyId,
        referenceType,
        referenceId,
        description,
      );

    return txPrisma
      ? operation(txPrisma)
      : this.walletTransactionService.run(operation);
  }

  /** Sprint 7.3.2: devolve saldo bloqueado -> disponível. */
  async releaseReservedBalance(
    userId: string,
    amount: Prisma.Decimal | number,
    currencyId: string,
    referenceType?: string,
    referenceId?: string,
    description?: string,
    txPrisma?: FinancialTx,
  ) {
    const amountDec = this.assertPositiveAmount(amount, 'desbloqueio');
    const operation = (tx: FinancialTx) =>
      this.releaseReservedBalanceInTx(
        tx,
        userId,
        amountDec,
        currencyId,
        referenceType,
        referenceId,
        description,
      );

    return txPrisma
      ? operation(txPrisma)
      : this.walletTransactionService.run(operation);
  }

  /**
   * Sprint 7.3.2: consome definitivamente saldo já bloqueado.
   * A captura reduz balanceBlocked; nunca toca novamente em balanceAvailable.
   */
  async captureReservedBalance(
    userId: string,
    amount: Prisma.Decimal | number,
    currencyId: string,
    referenceType?: string,
    referenceId?: string,
    description?: string,
    txPrisma?: FinancialTx,
  ) {
    const amountDec = this.assertPositiveAmount(amount, 'captura');
    const operation = (tx: FinancialTx) =>
      this.captureReservedBalanceInTx(
        tx,
        userId,
        amountDec,
        currencyId,
        referenceType,
        referenceId,
        description,
      );

    return txPrisma
      ? operation(txPrisma)
      : this.walletTransactionService.run(operation);
  }

  private async reserveBalanceInTx(
    tx: FinancialTx,
    userId: string,
    amount: Prisma.Decimal,
    currencyId: string,
    referenceType?: string,
    referenceId?: string,
    description?: string,
  ) {
    const wallet = await this.getOrCreateWalletInTx(tx, userId, currencyId);
    this.assertWalletCanMoveMoney(wallet, currencyId);

    const availableBefore = new Prisma.Decimal(wallet.balanceAvailable);
    const blockedBefore = new Prisma.Decimal(wallet.balanceBlocked);
    if (availableBefore.lt(amount)) {
      throw new BadRequestException('Saldo disponível insuficiente para realizar o bloqueio.');
    }

    const claimed = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        status: WalletStatus.ACTIVE,
        currencyId,
        balanceAvailable: availableBefore,
        balanceBlocked: blockedBefore,
      },
      data: {
        balanceAvailable: { decrement: amount },
        balanceBlocked: { increment: amount },
      },
    });
    if (claimed.count !== 1) throw this.concurrentModification();

    const refreshedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.ESCROW_HOLD,
        amount,
        balanceBefore: availableBefore,
        balanceAfter: refreshedWallet.balanceAvailable,
        referenceType,
        referenceId,
        description: description || 'Reserva de saldo da carteira',
      },
    });

    return { wallet: refreshedWallet, transaction };
  }

  private async releaseReservedBalanceInTx(
    tx: FinancialTx,
    userId: string,
    amount: Prisma.Decimal,
    currencyId: string,
    referenceType?: string,
    referenceId?: string,
    description?: string,
  ) {
    const wallet = await this.getOrCreateWalletInTx(tx, userId, currencyId);
    this.assertWalletCanMoveMoney(wallet, currencyId);

    const availableBefore = new Prisma.Decimal(wallet.balanceAvailable);
    const blockedBefore = new Prisma.Decimal(wallet.balanceBlocked);
    if (blockedBefore.lt(amount)) {
      throw new BadRequestException('Saldo bloqueado insuficiente para realizar o desbloqueio.');
    }

    const claimed = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        status: WalletStatus.ACTIVE,
        currencyId,
        balanceAvailable: availableBefore,
        balanceBlocked: blockedBefore,
      },
      data: {
        balanceAvailable: { increment: amount },
        balanceBlocked: { decrement: amount },
      },
    });
    if (claimed.count !== 1) throw this.concurrentModification();

    const refreshedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.ADJUSTMENT,
        amount,
        balanceBefore: availableBefore,
        balanceAfter: refreshedWallet.balanceAvailable,
        referenceType,
        referenceId,
        description: description || 'Desbloqueio de saldo reservado',
      },
    });

    return { wallet: refreshedWallet, transaction };
  }

  private async captureReservedBalanceInTx(
    tx: FinancialTx,
    userId: string,
    amount: Prisma.Decimal,
    currencyId: string,
    referenceType?: string,
    referenceId?: string,
    description?: string,
  ) {
    const wallet = await this.getOrCreateWalletInTx(tx, userId, currencyId);
    this.assertWalletCanMoveMoney(wallet, currencyId);

    const availableBefore = new Prisma.Decimal(wallet.balanceAvailable);
    const blockedBefore = new Prisma.Decimal(wallet.balanceBlocked);
    if (blockedBefore.lt(amount)) {
      throw new BadRequestException('Saldo bloqueado insuficiente para realizar a captura.');
    }

    const claimed = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        status: WalletStatus.ACTIVE,
        currencyId,
        balanceAvailable: availableBefore,
        balanceBlocked: blockedBefore,
      },
      data: { balanceBlocked: { decrement: amount } },
    });
    if (claimed.count !== 1) throw this.concurrentModification();

    const refreshedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.PAYMENT,
        amount,
        balanceBefore: blockedBefore,
        balanceAfter: refreshedWallet.balanceBlocked,
        referenceType,
        referenceId,
        description: description || 'Captura de saldo reservado',
      },
    });

    await this.ledgerService.createDoubleEntry(
      {
        debitAccount: LedgerAccountType.BUYER_WALLET,
        creditAccount: LedgerAccountType.PLATFORM_ESCROW,
        amount,
        currencyId,
        referenceType: referenceType || 'WalletTransaction',
        referenceId: referenceId || transaction.id,
        description: description || `Captura de saldo reservado do usuário ${userId}`,
      },
      tx,
    );

    return { wallet: refreshedWallet, transaction };
  }

  /**
   * Sprint 7.3.4: consome saldo bloqueado para um payout externo.
   * Diferente de captureReservedBalance(), este fluxo usa a conta contábil
   * SELLER_WALLET -> GATEWAY_CLEARING.
   */
  async captureReservedPayoutInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      amount: Prisma.Decimal | number | string;
      currencyId: string;
      payoutId: string;
      description?: string;
    },
  ) {
    const amount = this.assertPositiveAmount(
      new Prisma.Decimal(input.amount),
      'payout',
    );

    const wallet = await this.getOrCreateWalletInTx(
      tx,
      input.userId,
      input.currencyId,
    );
    this.assertWalletCanMoveMoney(wallet, input.currencyId);

    const availableBefore = new Prisma.Decimal(wallet.balanceAvailable);
    const blockedBefore = new Prisma.Decimal(wallet.balanceBlocked);

    if (blockedBefore.lt(amount)) {
      throw new BadRequestException(
        'Saldo bloqueado insuficiente para concluir o payout.',
      );
    }

    const claimed = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        status: WalletStatus.ACTIVE,
        currencyId: input.currencyId,
        balanceAvailable: availableBefore,
        balanceBlocked: blockedBefore,
      },
      data: {
        balanceBlocked: { decrement: amount },
      },
    });

    if (claimed.count !== 1) {
      throw this.concurrentModification();
    }

    const refreshedWallet = await tx.wallet.findUniqueOrThrow({
      where: { id: wallet.id },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.WITHDRAW,
        amount,
        balanceBefore: blockedBefore,
        balanceAfter: refreshedWallet.balanceBlocked,
        referenceType: 'Payout',
        referenceId: input.payoutId,
        description: input.description || 'Payout concluído',
      },
    });

    await this.ledgerService.createDoubleEntry(
      {
        debitAccount: LedgerAccountType.SELLER_WALLET,
        creditAccount: LedgerAccountType.GATEWAY_CLEARING,
        amount,
        currencyId: input.currencyId,
        referenceType: 'Payout',
        referenceId: input.payoutId,
        description:
          input.description || `Payout da carteira do vendedor ${input.userId}`,
      },
      tx,
    );

    return {
      wallet: refreshedWallet,
      transaction,
    };
  }

  async getTransactions(userId: string, limit = 20) {
    const wallet = await this.getOrCreateWallet(userId);

    return this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      take: Math.min(Math.max(limit, 1), 100),
      orderBy: { createdAt: 'desc' },
    });
  }

  private async depositInTx(
    tx: FinancialTx,
    userId: string,
    amount: Prisma.Decimal,
    currencyId: string,
    description?: string,
  ) {
    const wallet = await this.getOrCreateWalletInTx(tx, userId, currencyId);
    this.assertWalletCanMoveMoney(wallet, currencyId);

    const balanceBefore = new Prisma.Decimal(wallet.balanceAvailable);

    const updated = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        status: WalletStatus.ACTIVE,
        currencyId,
        balanceAvailable: balanceBefore,
      },
      data: { balanceAvailable: { increment: amount } },
    });

    if (updated.count !== 1) {
      throw this.concurrentModification();
    }

    const refreshedWallet = await tx.wallet.findUniqueOrThrow({
      where: { id: wallet.id },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.DEPOSIT,
        amount,
        balanceBefore,
        balanceAfter: refreshedWallet.balanceAvailable,
        description: description || 'Depósito na carteira',
      },
    });

    await this.ledgerService.createDoubleEntry(
      {
        debitAccount: LedgerAccountType.GATEWAY_CLEARING,
        creditAccount: LedgerAccountType.BUYER_WALLET,
        amount,
        currencyId: wallet.currencyId,
        referenceType: 'WalletTransaction',
        referenceId: transaction.id,
        description: `Depósito em carteira do usuário ${userId}`,
      },
      tx,
    );

    return { wallet: refreshedWallet, transaction };
  }

  private async withdrawInTx(
    tx: FinancialTx,
    userId: string,
    amount: Prisma.Decimal,
    currencyId: string,
    description?: string,
  ) {
    const wallet = await this.getOrCreateWalletInTx(tx, userId, currencyId);
    this.assertWalletCanMoveMoney(wallet, currencyId);

    const balanceBefore = new Prisma.Decimal(wallet.balanceAvailable);

    if (balanceBefore.lt(amount)) {
      throw new BadRequestException(
        'Saldo insuficiente na carteira para realizar o saque.',
      );
    }

    const updated = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        status: WalletStatus.ACTIVE,
        currencyId,
        balanceAvailable: balanceBefore,
      },
      data: { balanceAvailable: { decrement: amount } },
    });

    if (updated.count !== 1) {
      throw this.concurrentModification();
    }

    const refreshedWallet = await tx.wallet.findUniqueOrThrow({
      where: { id: wallet.id },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.WITHDRAW,
        amount,
        balanceBefore,
        balanceAfter: refreshedWallet.balanceAvailable,
        description: description || 'Saque da carteira',
      },
    });

    await this.ledgerService.createDoubleEntry(
      {
        debitAccount: LedgerAccountType.BUYER_WALLET,
        creditAccount: LedgerAccountType.GATEWAY_CLEARING,
        amount,
        currencyId: wallet.currencyId,
        referenceType: 'WalletTransaction',
        referenceId: transaction.id,
        description: `Saque de carteira do usuário ${userId}`,
      },
      tx,
    );

    return { wallet: refreshedWallet, transaction };
  }

  private async getOrCreateWalletInTx(
    tx: FinancialTx,
    userId: string,
    preferredCurrencyId?: string,
  ) {
    let wallet = await tx.wallet.findUnique({ where: { userId } });

    if (!wallet) {
      let currencyId = preferredCurrencyId;

      if (!currencyId) {
        const defaultCurrency = await tx.currency.findFirst();
        if (!defaultCurrency) {
          throw new NotFoundException('Nenhuma moeda configurada no sistema.');
        }
        currencyId = defaultCurrency.id;
      }

      wallet = await tx.wallet.create({
        data: {
          userId,
          currencyId,
          balanceAvailable: new Prisma.Decimal(0),
          balanceBlocked: new Prisma.Decimal(0),
          status: WalletStatus.ACTIVE,
        },
      });
    }

    return wallet;
  }

  private assertWalletCanMoveMoney(
    wallet: { status: WalletStatus; currencyId: string },
    currencyId: string,
  ) {
    if (wallet.status !== WalletStatus.ACTIVE) {
      throw new BadRequestException(
        'Carteira inativa ou bloqueada para transações.',
      );
    }

    if (wallet.currencyId !== currencyId) {
      throw new BadRequestException(
        'A moeda da operação é diferente da moeda configurada na carteira.',
      );
    }
  }

  private assertPositiveAmount(
    amount: Prisma.Decimal | number,
    operation: string,
  ): Prisma.Decimal {
    const amountDec = new Prisma.Decimal(amount);

    if (!amountDec.isFinite() || amountDec.lte(0)) {
      throw new BadRequestException(
        `O valor do ${operation} deve ser positivo.`,
      );
    }

    return amountDec;
  }

  private concurrentModification() {
    return new ConflictException({
      statusCode: 409,
      message:
        'O saldo da carteira foi alterado por outra operação. Tente novamente.',
      errorCode: 'WALLET_BALANCE_CONFLICT',
    });
  }
}
