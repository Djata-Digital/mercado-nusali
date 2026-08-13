import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  EscrowStatus,
  LedgerAccountType,
  OrderStatus,
  RefundStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { OutboxService } from '../outbox/outbox.service';
import { WalletService } from '../wallet/wallet.service';
import { EscrowEventsService } from './services/escrow-events.service';
import { EscrowReleasePolicyService } from './services/escrow-release-policy.service';
import { EscrowRefundPolicyService } from './services/escrow-refund-policy.service';
import { EscrowDisputeOutcome, EscrowDisputePolicyService } from './services/escrow-dispute-policy.service';
import { EscrowStateMachineService } from './services/escrow-state-machine.service';
import { EscrowTransactionService } from './services/escrow-transaction.service';

@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly outboxService: OutboxService,
    private readonly walletService: WalletService,
    private readonly escrowTransaction: EscrowTransactionService,
    private readonly stateMachine: EscrowStateMachineService,
    private readonly events: EscrowEventsService,
    private readonly releasePolicy: EscrowReleasePolicyService,
    private readonly refundPolicy: EscrowRefundPolicyService,
    private readonly disputePolicy: EscrowDisputePolicyService,
  ) {}

  async holdEscrow(
    data: {
      orderGroupId: string;
      orderId: string;
      sellerId: string;
      buyerId: string;
      totalAmount: Prisma.Decimal | number;
      commissionRate?: number;
      currencyId: string;
    },
    txPrisma?: Prisma.TransactionClient,
  ) {
    const operation = async (tx: Prisma.TransactionClient) => {
      const totalDec = new Prisma.Decimal(data.totalAmount);
      const rate = data.commissionRate !== undefined ? data.commissionRate : 0.1;
      const commissionAmount = totalDec.mul(rate).toDecimalPlaces(2);
      const disputeDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const existing = await tx.escrowAccount.findUnique({ where: { orderId: data.orderId } });
      if (existing) return existing;

      const escrow = await tx.escrowAccount.create({
        data: {
          orderGroupId: data.orderGroupId,
          orderId: data.orderId,
          sellerId: data.sellerId,
          buyerId: data.buyerId,
          totalAmount: totalDec,
          heldAmount: totalDec,
          commissionAmount,
          currencyId: data.currencyId,
          status: EscrowStatus.HELD,
          disputeDeadline,
        },
      });

      await tx.escrowTransaction.create({
        data: { escrowAccountId: escrow.id, type: 'HOLD', amount: totalDec },
      });

      await this.ledgerService.createDoubleEntry(
        {
          debitAccount: LedgerAccountType.GATEWAY_CLEARING,
          creditAccount: LedgerAccountType.PLATFORM_ESCROW,
          amount: totalDec,
          currencyId: data.currencyId,
          referenceType: 'EscrowAccount',
          referenceId: escrow.id,
          description: `Retenção em Escrow para o pedido ${data.orderId}`,
        },
        tx,
      );

      // Mantém compatibilidade com consumidores anteriores do OutboxService.
      await this.outboxService.publishEvent(
        'EscrowAccount',
        escrow.id,
        'escrow.created',
        { escrowAccountId: escrow.id, orderId: data.orderId, amount: totalDec },
        tx,
      );

      return escrow;
    };

    return txPrisma ? operation(txPrisma) : this.escrowTransaction.run(operation);
  }

  /** Libera todo o saldo ainda retido. Chamadas repetidas após RELEASED são idempotentes. */
  async releaseEscrow(
    orderId: string,
    txPrisma?: Prisma.TransactionClient,
    actorUserId?: string | null,
  ) {
    return this.release(orderId, undefined, txPrisma, actorUserId, false);
  }

  /** Libera apenas parte do saldo retido do pedido. */
  async releasePartial(
    orderId: string,
    amount: Prisma.Decimal | number | string,
    txPrisma?: Prisma.TransactionClient,
    actorUserId?: string | null,
  ) {
    return this.release(orderId, new Prisma.Decimal(amount), txPrisma, actorUserId, false);
  }

  private async release(
    orderId: string,
    requestedAmount?: Prisma.Decimal,
    txPrisma?: Prisma.TransactionClient,
    actorUserId?: string | null,
    allowDisputed = false,
  ) {
    const operation = async (tx: Prisma.TransactionClient) => {
      const escrow = await tx.escrowAccount.findUnique({
        where: { orderId },
        include: {
          seller: true,
          order: { select: { id: true, status: true, storeId: true } },
        },
      });

      if (!escrow) {
        throw new NotFoundException('Conta de Escrow não encontrada para o pedido informado.');
      }

      // A liberação total já concluída é uma operação idempotente: não cria novo
      // WalletTransaction, LedgerEntry nem OutboxEvent.
      if (escrow.status === EscrowStatus.RELEASED && escrow.heldAmount.eq(0)) {
        return escrow;
      }

      const decision = allowDisputed && escrow.order.status === OrderStatus.DISPUTED
        ? {
            releaseAmount: requestedAmount ?? new Prisma.Decimal(escrow.heldAmount),
            targetStatus: EscrowStatus.RELEASED,
            isPartial: false,
          }
        : this.releasePolicy.evaluate({
            orderStatus: escrow.order.status,
            escrowStatus: escrow.status,
            heldAmount: escrow.heldAmount,
            requestedAmount,
            disputeDeadline: escrow.disputeDeadline,
          });

      const commissionForRelease = this.calculateCommissionForRelease(
        escrow.totalAmount,
        escrow.commissionAmount,
        escrow.releasedAmount,
        decision.releaseAmount,
      );
      const sellerNetAmount = decision.releaseAmount.sub(commissionForRelease);

      if (sellerNetAmount.lt(0)) {
        throw new ConflictException({
          statusCode: 409,
          message: 'A comissão calculada excede o valor da liberação.',
          errorCode: 'ESCROW_INVALID_COMMISSION_ALLOCATION',
        });
      }

      // Claim financeiro: status + heldAmount + releasedAmount são comparados e
      // atualizados atomicamente antes de qualquer crédito. Se outro worker já
      // consumiu o saldo, nenhum payout é efetuado.
      const updatedEscrow = await this.stateMachine.transitionRelease(tx, {
        escrowAccountId: escrow.id,
        toStatus: decision.targetStatus,
        expectedStatus: escrow.status,
        expectedHeldAmount: escrow.heldAmount,
        expectedReleasedAmount: escrow.releasedAmount,
        releaseAmount: decision.releaseAmount,
      });

      await tx.escrowTransaction.create({
        data: {
          escrowAccountId: escrow.id,
          type: decision.isPartial ? 'PARTIAL_RELEASE' : 'RELEASE',
          amount: decision.releaseAmount,
        },
      });

      if (sellerNetAmount.gt(0)) {
        await this.walletService.creditEscrowReleaseInTransaction(tx, {
          userId: escrow.seller.userId,
          amount: sellerNetAmount,
          currencyId: escrow.currencyId,
          escrowAccountId: escrow.id,
          orderId,
        });

        await this.ledgerService.createDoubleEntry(
          {
            debitAccount: LedgerAccountType.PLATFORM_ESCROW,
            creditAccount: LedgerAccountType.SELLER_WALLET,
            amount: sellerNetAmount,
            currencyId: escrow.currencyId,
            referenceType: 'EscrowAccount',
            referenceId: escrow.id,
            description: `Liberação de saldo para carteira do vendedor ${escrow.seller.userId}`,
            createdById: actorUserId || undefined,
          },
          tx,
        );
      }

      if (commissionForRelease.gt(0)) {
        await this.ledgerService.createDoubleEntry(
          {
            debitAccount: LedgerAccountType.PLATFORM_ESCROW,
            creditAccount: LedgerAccountType.PLATFORM_REVENUE,
            amount: commissionForRelease,
            currencyId: escrow.currencyId,
            referenceType: 'EscrowAccount',
            referenceId: escrow.id,
            description: `Comissão da plataforma sobre o pedido ${orderId}`,
            createdById: actorUserId || undefined,
          },
          tx,
        );
      }

      const payload = {
        escrowAccountId: escrow.id,
        orderId,
        orderGroupId: escrow.orderGroupId,
        storeId: escrow.order.storeId,
        sellerId: escrow.sellerId,
        currencyId: escrow.currencyId,
        grossAmount: decision.releaseAmount,
        sellerNetAmount,
        platformFee: commissionForRelease,
        remainingAmount: new Prisma.Decimal(updatedEscrow.heldAmount),
        releasedAt: new Date().toISOString(),
      };

      if (decision.isPartial) {
        await this.events.recordPartiallyReleased(tx, escrow.id, payload);
      } else {
        await this.events.recordReleased(tx, escrow.id, payload);
      }

      return updatedEscrow;
    };

    return txPrisma ? operation(txPrisma) : this.escrowTransaction.run(operation);
  }

  /**
   * Distribui a comissão proporcionalmente, usando cálculo cumulativo para que
   * arredondamentos de liberações parciais nunca façam a soma ultrapassar a
   * comissão total. Na liberação final, todo o resíduo de centavos é alocado.
   */
  private calculateCommissionForRelease(
    totalAmount: Prisma.Decimal,
    totalCommission: Prisma.Decimal,
    previouslyReleased: Prisma.Decimal,
    currentRelease: Prisma.Decimal,
  ): Prisma.Decimal {
    if (totalAmount.lte(0) || totalCommission.lte(0)) return new Prisma.Decimal(0);

    const newReleased = previouslyReleased.add(currentRelease);
    const previousCommission = previouslyReleased.lte(0)
      ? new Prisma.Decimal(0)
      : totalCommission
          .mul(previouslyReleased)
          .div(totalAmount)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const cumulativeCommission = newReleased.gte(totalAmount)
      ? totalCommission
      : totalCommission
          .mul(newReleased)
          .div(totalAmount)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    return cumulativeCommission.sub(previousCommission);
  }

  async refundEscrow(
    orderId: string,
    amount?: Prisma.Decimal | number | string,
    txPrisma?: Prisma.TransactionClient,
    actorUserId?: string | null,
    options?: { allowDisputed?: boolean; paymentId?: string; reason?: string; targetStatus?: EscrowStatus; refundId?: string },
  ) {
    const operation = async (tx: Prisma.TransactionClient) => {
      const escrow = await tx.escrowAccount.findUnique({
        where: { orderId },
        include: { order: { select: { id: true, status: true, storeId: true, orderNumber: true } } },
      });
      if (!escrow) throw new NotFoundException('Conta de Escrow não encontrada para o pedido informado.');
      if (escrow.status === EscrowStatus.REFUNDED && escrow.heldAmount.eq(0)) {
        const existingRefund = options?.paymentId
          ? await tx.refund.findFirst({ where: { paymentId: options.paymentId, orderId } })
          : null;
        return { escrow, refund: existingRefund };
      }

      const decision = this.refundPolicy.evaluate({
        orderStatus: escrow.order.status,
        escrowStatus: escrow.status,
        heldAmount: escrow.heldAmount,
        releasedAmount: escrow.releasedAmount,
        requestedAmount: amount,
        allowDisputed: options?.allowDisputed,
      });
      const targetStatus = options?.targetStatus ?? decision.targetStatus;

      const updatedEscrow = await this.stateMachine.transitionRefund(tx, {
        escrowAccountId: escrow.id,
        toStatus: targetStatus,
        expectedStatus: escrow.status,
        expectedHeldAmount: escrow.heldAmount,
        expectedRefundedAmount: escrow.refundedAmount,
        refundAmount: decision.refundAmount,
      });

      await tx.escrowTransaction.create({
        data: {
          escrowAccountId: escrow.id,
          type: targetStatus === EscrowStatus.CANCELLED ? 'CANCEL_REFUND' : 'REFUND',
          amount: decision.refundAmount,
        },
      });

      await this.walletService.creditEscrowRefundInTransaction(tx, {
        userId: escrow.buyerId,
        amount: decision.refundAmount,
        currencyId: escrow.currencyId,
        escrowAccountId: escrow.id,
        orderId,
      });

      await this.ledgerService.createDoubleEntry({
        debitAccount: LedgerAccountType.PLATFORM_ESCROW,
        creditAccount: LedgerAccountType.BUYER_WALLET,
        amount: decision.refundAmount,
        currencyId: escrow.currencyId,
        referenceType: 'EscrowAccount',
        referenceId: escrow.id,
        description: `Reembolso de Escrow do pedido ${escrow.order.orderNumber}`,
        createdById: actorUserId || undefined,
      }, tx);

      let refund: any = null;
      if (options?.refundId) {
        const claimedRefund = await tx.refund.updateMany({
          where: { id: options.refundId, paymentId: options.paymentId, orderId, status: RefundStatus.PROCESSING },
          data: { status: RefundStatus.COMPLETED, processedAt: new Date() },
        });
        if (claimedRefund.count !== 1) {
          throw new ConflictException({ statusCode: 409, message: 'O reembolso foi alterado concorrentemente.', errorCode: 'REFUND_CONCURRENT_MODIFICATION' });
        }
        refund = await tx.refund.findUniqueOrThrow({ where: { id: options.refundId } });
      } else if (options?.paymentId) {
        refund = await tx.refund.create({
          data: {
            paymentId: options.paymentId,
            orderId,
            buyerId: escrow.buyerId,
            amount: decision.refundAmount,
            currencyId: escrow.currencyId,
            reason: options.reason,
            status: RefundStatus.COMPLETED,
            processedAt: new Date(),
          },
        });
      }

      const payload = {
        escrowAccountId: escrow.id,
        orderId,
        buyerId: escrow.buyerId,
        currencyId: escrow.currencyId,
        amount: decision.refundAmount,
        remainingAmount: new Prisma.Decimal(updatedEscrow.heldAmount),
        status: updatedEscrow.status,
      };
      if (targetStatus === EscrowStatus.CANCELLED) {
        await this.events.recordCancelled(tx, escrow.id, payload);
      } else {
        await this.events.recordRefunded(tx, escrow.id, payload);
      }
      return { escrow: updatedEscrow, refund };
    };
    return txPrisma ? operation(txPrisma) : this.escrowTransaction.run(operation);
  }

  async cancelEscrow(orderId: string, txPrisma?: Prisma.TransactionClient, actorUserId?: string | null) {
    const operation = async (tx: Prisma.TransactionClient) => {
      const escrow = await tx.escrowAccount.findUnique({ where: { orderId }, include: { order: true } });
      if (!escrow) throw new NotFoundException('Conta de Escrow não encontrada.');
      if (escrow.status === EscrowStatus.CANCELLED && escrow.heldAmount.eq(0)) return escrow;
      if (escrow.order.status !== OrderStatus.CANCELLED) {
        throw new ConflictException({ statusCode: 409, message: 'O pedido precisa estar CANCELLED antes do cancelamento financeiro do Escrow.', errorCode: 'ESCROW_ORDER_NOT_CANCELLED' });
      }
      const result = await this.refundEscrow(orderId, undefined, tx, actorUserId, { targetStatus: EscrowStatus.CANCELLED });
      return result.escrow;
    };
    return txPrisma ? operation(txPrisma) : this.escrowTransaction.run(operation);
  }

  async openDispute( orderId: string, actorUserId?: string | null, reason?: string,) {
    return this.escrowTransaction.run(async (tx) => {
      const escrow = await tx.escrowAccount.findUnique({ where: { orderId }, include: { order: true } });
      if (!escrow) throw new NotFoundException('Conta de Escrow não encontrada.');
      this.disputePolicy.assertCanOpen(escrow.order.status, escrow.status);
      if (escrow.order.status === OrderStatus.DISPUTED) return escrow;

      const claimed = await tx.order.updateMany({ where: { id: orderId, status: escrow.order.status }, data: { status: OrderStatus.DISPUTED } });
      if (claimed.count !== 1) throw new ConflictException({ statusCode: 409, message: 'O pedido foi alterado concorrentemente.', errorCode: 'ESCROW_CONCURRENT_MODIFICATION' });
      await tx.orderStatusHistory.create({
        data: {
          orderId,

          previousStatus:
            escrow.order.status,

          newStatus:
            OrderStatus.DISPUTED,

          reason:
            reason?.trim() ||
            'Disputa de Escrow aberta',

          changedById:
            actorUserId ||
            undefined,

          metadataJson: {
            type:
              'ESCROW_DISPUTE_OPENED',
          },
        },
      });

      if (reason?.trim()) {
        await tx.orderComment.create({
          data: {
            orderId,

            authorId:
              actorUserId ||
              undefined,

            comment:
              reason.trim(),

            isPrivate: false,

            metadataJson: {
              type:
                'DISPUTE_OPENING_REASON',
            },
          },
        });
      }

      await tx.orderTimeline.create({
        data: {
          orderId,

          eventCode:
            'DISPUTE_OPENED',

          title:
            'Disputa aberta',

          description:
            reason?.trim() ||
            'Disputa de Escrow aberta.',

          actorId:
            actorUserId ||
            undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          userId:
            actorUserId ||
            undefined,

          action:
            'ESCROW_DISPUTE_OPENED',

          entity:
            'Order',

          entityId:
            orderId,

          newValue: {
            reason:
              reason?.trim() ||
              null,

            previousStatus:
              escrow.order.status,

            newStatus:
              OrderStatus.DISPUTED,
          },
        },
      });
      await this.events.recordDisputeOpened(tx, escrow.id, { escrowAccountId: escrow.id, orderId, previousOrderStatus: escrow.order.status });
      return tx.escrowAccount.findUniqueOrThrow({ where: { id: escrow.id } });
    });
  }

  async resolveDispute( orderId: string, outcome: EscrowDisputeOutcome, actorUserId?: string | null, note?: string,) {
    return this.escrowTransaction.run(async (tx) => {
      const escrow = await tx.escrowAccount.findUnique({ where: { orderId }, include: { order: true } });
      if (!escrow) throw new NotFoundException('Conta de Escrow não encontrada.');
      this.disputePolicy.assertCanResolve(escrow.order.status, escrow.status, outcome);

      let result: any;
      let finalOrderStatus: OrderStatus;
      if (outcome === 'BUYER_WINS') {
        result = await this.refundEscrow(orderId, undefined, tx, actorUserId, { allowDisputed: true });
        finalOrderStatus = OrderStatus.REFUNDED;
      } else {
        result = await this.release(orderId, undefined, tx, actorUserId, true);
        finalOrderStatus = OrderStatus.COMPLETED;
      }

      const changed = await tx.order.updateMany({ where: { id: orderId, status: OrderStatus.DISPUTED }, data: { status: finalOrderStatus } });
      if (changed.count !== 1) throw new ConflictException({ statusCode: 409, message: 'A resolução da disputa perdeu a concorrência.', errorCode: 'ESCROW_CONCURRENT_MODIFICATION' });
      await tx.orderStatusHistory.create({ data: { orderId, previousStatus: OrderStatus.DISPUTED, newStatus: finalOrderStatus, reason: `Disputa resolvida: ${outcome}`, changedById: actorUserId || undefined } });
      if (note?.trim()) {
        await tx.orderComment.create({
          data: {
            orderId,

            authorId:
              actorUserId ||
              undefined,

            comment:
              note.trim(),

            isPrivate: false,

            metadataJson: {
              type:
                'DISPUTE_RESOLUTION_NOTE',

              outcome,
            },
          },
        });
      }

      await tx.orderTimeline.create({
        data: {
          orderId,

          eventCode:
            'DISPUTE_RESOLVED',

          title:
            outcome ===
            'BUYER_WINS'
              ? 'Disputa resolvida a favor do comprador'
              : 'Disputa resolvida a favor do vendedor',

          description:
            note?.trim() ||
            (outcome ===
            'BUYER_WINS'
              ? 'Saldo retido encaminhado ao fluxo real de reembolso.'
              : 'Saldo retido liberado ao vendedor.'),

          actorId:
            actorUserId ||
            undefined,

          metadataJson: {
            outcome,
            finalOrderStatus,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId:
            actorUserId ||
            undefined,

          action:
            'ESCROW_DISPUTE_RESOLVED',

          entity:
            'Order',

          entityId:
            orderId,

          previousValue: {
            status:
              OrderStatus.DISPUTED,
          },

          newValue: {
            outcome,
            finalOrderStatus,
            note:
              note?.trim() ||
              null,
          },
        },
      });
      await this.events.recordDisputeResolved(tx, escrow.id, { escrowAccountId: escrow.id, orderId, outcome, finalOrderStatus });
      return result;
    });
  }

  async listAdminDisputes(query?: {
    status?: string;
    limit?: number;
  }) {
    const limit = Math.min(
      Math.max(
        Number(query?.limit) || 100,
        1,
      ),
      200,
    );

    const status =
      query?.status
        ?.trim()
        .toUpperCase();

    const disputeHistoryFilter = {
      some: {
        newStatus:
          OrderStatus.DISPUTED,
      },
    };

    const where: Prisma.OrderWhereInput =
      status === 'OPEN'
        ? {
            status:
              OrderStatus.DISPUTED,
          }
        : status === 'RESOLVED'
          ? {
              statusHistory:
                disputeHistoryFilter,

              status: {
                in: [
                  OrderStatus.REFUNDED,
                  OrderStatus.COMPLETED,
                ],
              },
            }
          : {
              statusHistory:
                disputeHistoryFilter,
            };

    return this.prisma.order.findMany({
      where,

      take: limit,

      orderBy: {
        updatedAt: 'desc',
      },

      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            phoneCode: true,
          },
        },

        seller: {
          select: {
            id: true,
            legalName: true,
            tradeName: true,
          },
        },

        store: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },

        currency: true,

        items: {
          select: {
            id: true,
            productTitleSnapshot: true,
            variantNameSnapshot: true,
            skuSnapshot: true,
            quantity: true,
            total: true,
          },
        },

        escrowAccount: {
          include: {
            transactions: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },

        statusHistory: {
          where: {
            OR: [
              {
                newStatus:
                  OrderStatus.DISPUTED,
              },
              {
                previousStatus:
                  OrderStatus.DISPUTED,
              },
            ],
          },

          orderBy: {
            createdAt: 'asc',
          },
        },

        comments: {
          orderBy: {
            createdAt: 'asc',
          },

          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },

        attachments: {
          orderBy: {
            createdAt: 'asc',
          },
        },

        timeline: {
          orderBy: {
            createdAt: 'asc',
          },
        },

        refunds: {
          include: {
            currency: true,
          },

          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async getAdminDispute(
    orderId: string,
  ) {
    const order =
      await this.prisma.order.findFirst({
        where: {
          id: orderId,

          statusHistory: {
            some: {
              newStatus:
                OrderStatus.DISPUTED,
            },
          },
        },

        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              phoneCode: true,
            },
          },

          seller: {
            select: {
              id: true,
              legalName: true,
              tradeName: true,
            },
          },

          store: true,

          currency: true,

          items: true,

          escrowAccount: {
            include: {
              currency: true,

              transactions: {
                orderBy: {
                  createdAt: 'asc',
                },
              },
            },
          },

          comments: {
            orderBy: {
              createdAt: 'asc',
            },

            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },

          attachments: {
            orderBy: {
              createdAt: 'asc',
            },
          },

          timeline: {
            orderBy: {
              createdAt: 'asc',
            },
          },

          statusHistory: {
            orderBy: {
              createdAt: 'asc',
            },

            include: {
              changedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },

          refunds: {
            include: {
              currency: true,
            },

            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

    if (!order) {
      throw new NotFoundException(
        'Disputa não encontrada.',
      );
    }

    return order;
  }

  async addAdminDisputeMessage(
    orderId: string,
    actorUserId: string | null,
    message: string,
    isPrivate = false,
  ) {
    const normalizedMessage =
      message.trim();

    if (!normalizedMessage) {
      throw new BadRequestException(
        'A mensagem não pode estar vazia.',
      );
    }

    return this.escrowTransaction.run(
      async (tx) => {
        const order =
          await tx.order.findUnique({
            where: {
              id: orderId,
            },

            select: {
              id: true,
              status: true,

              statusHistory: {
                where: {
                  newStatus:
                    OrderStatus.DISPUTED,
                },

                take: 1,
              },
            },
          });

        if (
          !order ||
          !order.statusHistory.length
        ) {
          throw new NotFoundException(
            'Disputa não encontrada.',
          );
        }

        const comment =
          await tx.orderComment.create({
            data: {
              orderId,

              authorId:
                actorUserId ||
                undefined,

              comment:
                normalizedMessage,

              isPrivate,

              metadataJson: {
                type:
                  'DISPUTE_MEDIATION_MESSAGE',

                source:
                  'ADMIN',

                isPrivate,
              },
            },
          });

        await tx.orderTimeline.create({
          data: {
            orderId,

            eventCode:
              'DISPUTE_ADMIN_MESSAGE',

            title:
              isPrivate
                ? 'Nota interna da mediação'
                : 'Mensagem da mediação',

            description:
              normalizedMessage,

            actorId:
              actorUserId ||
              undefined,

            metadataJson: {
              commentId:
                comment.id,

              isPrivate,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            userId:
              actorUserId ||
              undefined,

            action:
              'DISPUTE_MESSAGE_ADDED',

            entity:
              'Order',

            entityId:
              orderId,

            newValue: {
              commentId:
                comment.id,

              isPrivate,
            },
          },
        });

        return comment;
      },
    );
  }

  async getEscrowByOrderId(orderId: string) {
    const escrow = await this.prisma.escrowAccount.findUnique({
      where: { orderId },
      include: { transactions: true, currency: true },
    });
    if (!escrow) throw new NotFoundException('Conta de custódia não encontrada.');
    return escrow;
  }
}
