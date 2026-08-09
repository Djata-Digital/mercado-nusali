import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { EscrowService } from '../escrow/escrow.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefundTransactionService } from './services/refund-transaction.service';
import { RefundProviderExecutionService } from './services/refund-provider-execution.service';

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escrowService: EscrowService,
    private readonly refundTransaction: RefundTransactionService,
    private readonly providerExecution: RefundProviderExecutionService,
  ) {}

  async processRefund(
    userId: string,
    paymentId: string,
    orderId: string,
    amount?: number | Prisma.Decimal,
    reason?: string,
  ) {
    const requested = amount === undefined ? undefined : new Prisma.Decimal(amount);
    if (requested && requested.lte(0)) {
      throw new BadRequestException('O valor do reembolso deve ser positivo.');
    }

    const created = await this.refundTransaction.run(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Pagamento não encontrado.');
      if (payment.buyerId !== userId) throw new ForbiddenException('Acesso negado ao pagamento informado.');

      if (
        payment.status !== PaymentStatus.CAPTURED &&
        payment.status !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        if (payment.status === PaymentStatus.REFUNDED) {
          const existing = await tx.refund.findFirst({
            where: { paymentId, orderId, status: RefundStatus.COMPLETED },
            orderBy: { createdAt: 'desc' },
          });
          if (existing) return { refund: existing, cached: true as const };
        }
        throw new ConflictException('Somente pagamentos capturados podem ser reembolsados.');
      }

      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (order.userId !== userId) throw new ForbiddenException('Acesso negado ao reembolso deste pedido.');
      if (payment.orderGroupId !== order.orderGroupId) {
        throw new ForbiddenException('O pagamento informado não pertence ao grupo deste pedido.');
      }

      const escrow = await tx.escrowAccount.findUnique({ where: { orderId } });
      if (!escrow) throw new NotFoundException('Conta de Escrow não encontrada para o pedido informado.');

      // Serializa criação de refunds diferentes sobre o mesmo Payment.
      await tx.payment.update({ where: { id: payment.id }, data: { updatedAt: new Date() } });

      const active = await tx.refund.aggregate({
        where: {
          paymentId,
          status: {
            in: [RefundStatus.PENDING, RefundStatus.PROCESSING, RefundStatus.COMPLETED],
          },
        },
        _sum: { amount: true },
      });
      const reserved = active._sum.amount ?? new Prisma.Decimal(0);
      const paymentRemaining = payment.amount.sub(reserved);
      const refundAmount = requested ?? Prisma.Decimal.min(paymentRemaining, escrow.heldAmount);

      if (refundAmount.lte(0)) throw new ConflictException('Não existe saldo disponível para reembolso.');
      if (refundAmount.gt(paymentRemaining)) {
        throw new ConflictException('O reembolso excede o saldo restante do pagamento.');
      }
      if (refundAmount.gt(escrow.heldAmount)) {
        throw new ConflictException('O reembolso excede o saldo ainda retido no Escrow.');
      }

      const refund = await tx.refund.create({
        data: {
          paymentId,
          orderId,
          buyerId: userId,
          amount: refundAmount,
          currencyId: payment.currencyId,
          reason,
          status: RefundStatus.PENDING,
        },
      });
      return { refund, cached: false as const };
    });

    if (created.cached) return created.refund;
    return this.providerExecution.execute(created.refund.id);
  }

  async retryRefund(userId: string, refundId: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('Registro de reembolso não encontrado.');
    if (refund.buyerId !== userId) throw new ForbiddenException('Acesso negado ao reembolso informado.');
    return this.providerExecution.retry(refundId);
  }

  async reconcileRefund(refundId: string) {
    return this.providerExecution.reconcile(refundId);
  }

  async getRefundById(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { items: true, currency: true },
    });
    if (!refund) throw new NotFoundException('Registro de reembolso não encontrado.');
    return refund;
  }

  async listBuyerRefunds(userId: string) {
    return this.prisma.refund.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { currency: true, order: true },
    });
  }
}
