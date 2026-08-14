import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  OrderStatus,
  Prisma,
  RefundStatus,
  ReturnInspectionDecision,
  ReturnStatus,
  WarehouseStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { RefundsService } from '../refunds/refunds.service';

import {
  AdminAuthorizeReturnDto,
  AdminInspectReturnDto,
  CreateReturnRequestDto,
} from './dto/returns.dto';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly refundsService:
      RefundsService,
  ) {}

  private generateReturnNumber() {
    const date =
      new Date();

    const stamp =
      `${date.getUTCFullYear()}${String(
        date.getUTCMonth() + 1,
      ).padStart(
        2,
        '0',
      )}${String(
        date.getUTCDate(),
      ).padStart(
        2,
        '0',
      )}`;

    const random =
      Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    return `RET-${stamp}-${random}`;
  }

  private generateReverseTrackingCode() {
    const random =
      Math.random()
        .toString(36)
        .slice(2, 10)
        .toUpperCase();

    return `NUSALI-RET-${random}`;
  }

  async createBuyerReturn(
    userId: string,
    dto: CreateReturnRequestDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order =
          await tx.order.findUnique({
            where: {
              id: dto.orderId,
            },

            include: {
              items: true,

              returnRequests: {
                where: {
                  status: {
                    notIn: [
                      ReturnStatus.REJECTED,
                      ReturnStatus.CANCELLED,
                      ReturnStatus.CLOSED,
                    ],
                  },
                },
              },
            },
          });

        if (!order) {
          throw new NotFoundException(
            'Pedido não encontrado.',
          );
        }

        if (
          order.userId !==
          userId
        ) {
          throw new ForbiddenException(
            'Você não pode solicitar devolução deste pedido.',
          );
        }

        if (
          order.status !==
            OrderStatus.DELIVERED &&
          order.status !==
            OrderStatus.COMPLETED
        ) {
          throw new ConflictException(
            'A devolução só pode ser solicitada após a entrega do pedido.',
          );
        }

        if (
          order.returnRequests
            .length > 0
        ) {
          throw new ConflictException(
            'Já existe uma devolução ativa para este pedido.',
          );
        }

        const orderItems =
          new Map(
            order.items.map(
              (item) => [
                item.id,
                item,
              ],
            ),
          );

        for (
          const inputItem of
          dto.items
        ) {
          const item =
            orderItems.get(
              inputItem.orderItemId,
            );

          if (!item) {
            throw new BadRequestException(
              `Item ${inputItem.orderItemId} não pertence ao pedido informado.`,
            );
          }

          if (
            inputItem.quantity >
            item.quantity
          ) {
            throw new BadRequestException(
              `Quantidade de devolução superior à quantidade comprada para o item ${item.id}.`,
            );
          }
        }

        let returnNumber =
          this.generateReturnNumber();

        while (
          await tx.returnRequest.findUnique(
            {
              where: {
                returnNumber,
              },
            },
          )
        ) {
          returnNumber =
            this.generateReturnNumber();
        }

        const created =
          await tx.returnRequest.create(
            {
              data: {
                returnNumber,

                orderId:
                  order.id,

                buyerId:
                  order.userId,

                sellerId:
                  order.sellerId,

                reason:
                  dto.reason,

                reasonDetails:
                  dto.reasonDetails,

                items: {
                  create:
                    dto.items.map(
                      (item) => ({
                        orderItemId:
                          item.orderItemId,

                        quantity:
                          item.quantity,

                        reason:
                          item.reason,

                        notes:
                          item.notes,
                      }),
                    ),
                },

                history: {
                  create: {
                    newStatus:
                      ReturnStatus.REQUESTED,

                    reason:
                      dto.reasonDetails ||
                      `Solicitação de devolução: ${dto.reason}`,

                    changedById:
                      userId,
                  },
                },
              },

              include: {
                items: true,
                history: true,
              },
            },
          );

        await tx.order.update({
          where: {
            id: order.id,
          },

          data: {
            status:
              OrderStatus.RETURN_REQUESTED,
          },
        });

        await tx.orderStatusHistory.create(
          {
            data: {
              orderId:
                order.id,

              previousStatus:
                order.status,

              newStatus:
                OrderStatus.RETURN_REQUESTED,

              reason:
                dto.reasonDetails ||
                `Devolução ${returnNumber} solicitada.`,

              changedById:
                userId,

              metadataJson: {
                returnRequestId:
                  created.id,

                returnNumber:
                  created.returnNumber,
              },
            },
          },
        );

        await tx.orderTimeline.create(
          {
            data: {
              orderId:
                order.id,

              eventCode:
                'RETURN_REQUESTED',

              title:
                'Devolução solicitada',

              description:
                dto.reasonDetails ||
                `Solicitação ${returnNumber}`,

              actorId:
                userId,

              metadataJson: {
                returnRequestId:
                  created.id,

                returnNumber:
                  created.returnNumber,
              },
            },
          },
        );

        return created;
      },
    );
  }

  async listBuyerReturns(
    userId: string,
  ) {
    return this.prisma.returnRequest.findMany(
      {
        where: {
          buyerId:
            userId,
        },

        orderBy: {
          createdAt:
            'desc',
        },

        include:
          this.defaultInclude(),
      },
    );
  }

  async getBuyerReturn(
    userId: string,
    returnId: string,
  ) {
    const result =
      await this.prisma.returnRequest.findUnique(
        {
          where: {
            id: returnId,
          },

          include:
            this.defaultInclude(),
        },
      );

    if (!result) {
      throw new NotFoundException(
        'Devolução não encontrada.',
      );
    }

    if (
      result.buyerId !==
      userId
    ) {
      throw new ForbiddenException(
        'Acesso negado a esta devolução.',
      );
    }

    return result;
  }

  async listAdminReturns(
    status?: ReturnStatus,
    limit = 100,
  ) {
    const take =
      Math.min(
        Math.max(
          Number(limit) ||
            100,
          1,
        ),
        200,
      );

    return this.prisma.returnRequest.findMany(
      {
        where: {
          ...(status
            ? {
                status,
              }
            : {}),
        },

        take,

        orderBy: {
          updatedAt:
            'desc',
        },

        include:
          this.defaultInclude(),
      },
    );
  }

  async getAdminReturn(
    returnId: string,
  ) {
    const result =
      await this.prisma.returnRequest.findUnique(
        {
          where: {
            id: returnId,
          },

          include:
            this.defaultInclude(),
        },
      );

    if (!result) {
      throw new NotFoundException(
        'Devolução não encontrada.',
      );
    }

    return result;
  }

  async authorize(
    returnId: string,
    actorUserId: string,
    dto: AdminAuthorizeReturnDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current =
          await tx.returnRequest.findUnique(
            {
              where: {
                id: returnId,
              },
            },
          );

        if (!current) {
          throw new NotFoundException(
            'Devolução não encontrada.',
          );
        }

        if (
          current.status !==
          ReturnStatus.REQUESTED
        ) {
          throw new ConflictException(
            'Somente devoluções solicitadas podem ser autorizadas.',
          );
        }

        if (dto.carrierId) {
          const carrier =
            await tx.carrier.findUnique(
              {
                where: {
                  id: dto.carrierId,
                },
              },
            );

          if (!carrier) {
            throw new NotFoundException(
              'Transportadora não encontrada.',
            );
          }

          if (
            !carrier.supportsReturns
          ) {
            throw new ConflictException(
              'A transportadora selecionada não aceita logística reversa.',
            );
          }
        }

        if (
          dto.returnWarehouseId
        ) {
          const warehouse =
            await tx.warehouse.findUnique(
              {
                where: {
                  id: dto.returnWarehouseId,
                },
              },
            );

          if (!warehouse) {
            throw new NotFoundException(
              'HUB/armazém de devolução não encontrado.',
            );
          }

          if (
            warehouse.status !==
            WarehouseStatus.ACTIVE
          ) {
            throw new ConflictException(
              'O HUB/armazém selecionado não está ativo.',
            );
          }
        }

        let reverseTrackingCode =
          dto.reverseTrackingCode?.trim() ||
          this.generateReverseTrackingCode();

        while (
          await tx.returnRequest.findUnique(
            {
              where: {
                reverseTrackingCode,
              },
            },
          )
        ) {
          reverseTrackingCode =
            this.generateReverseTrackingCode();
        }

        const updated =
          await tx.returnRequest.update(
            {
              where: {
                id: returnId,
              },

              data: {
                status:
                  ReturnStatus.AUTHORIZED,

                authorizedAt:
                  new Date(),

                reverseTrackingCode,

                carrierId:
                  dto.carrierId,

                returnWarehouseId:
                  dto.returnWarehouseId,
              },
            },
          );

        await tx.returnHistory.create(
          {
            data: {
              returnRequestId:
                returnId,

              previousStatus:
                current.status,

              newStatus:
                ReturnStatus.AUTHORIZED,

              reason:
                dto.note ||
                'Devolução autorizada.',

              changedById:
                actorUserId,

              metadataJson: {
                reverseTrackingCode,
                carrierId:
                  dto.carrierId ||
                  null,
                returnWarehouseId:
                  dto.returnWarehouseId ||
                  null,
              },
            },
          },
        );

        return updated;
      },
    );
  }

  async reject(
    returnId: string,
    actorUserId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current =
          await tx.returnRequest.findUnique(
            {
              where: {
                id: returnId,
              },

              include: {
                order: true,
              },
            },
          );

        if (!current) {
          throw new NotFoundException(
            'Devolução não encontrada.',
          );
        }

        if (
          current.status !==
          ReturnStatus.REQUESTED
        ) {
          throw new ConflictException(
            'Somente devoluções solicitadas podem ser rejeitadas.',
          );
        }

        const updated =
          await tx.returnRequest.update(
            {
              where: {
                id: returnId,
              },

              data: {
                status:
                  ReturnStatus.REJECTED,

                completedAt:
                  new Date(),

                inspectionNotes:
                  reason,
              },
            },
          );

        await tx.returnHistory.create(
          {
            data: {
              returnRequestId:
                returnId,

              previousStatus:
                current.status,

              newStatus:
                ReturnStatus.REJECTED,

              reason,

              changedById:
                actorUserId,
            },
          },
        );

        await tx.order.update({
          where: {
            id:
              current.orderId,
          },

          data: {
            status:
              OrderStatus.COMPLETED,
          },
        });

        await tx.orderStatusHistory.create(
          {
            data: {
              orderId:
                current.orderId,

              previousStatus:
                OrderStatus.RETURN_REQUESTED,

              newStatus:
                OrderStatus.COMPLETED,

              reason:
                `Devolução ${current.returnNumber} rejeitada: ${reason}`,

              changedById:
                actorUserId,
            },
          },
        );

        return updated;
      },
    );
  }

  async markInTransit(
    returnId: string,
    actorUserId: string,
    note?: string,
  ) {
    return this.changeStatus(
      returnId,
      actorUserId,
      ReturnStatus.IN_TRANSIT,
      [
        ReturnStatus.AUTHORIZED,
      ],
      note ||
        'Produto enviado em logística reversa.',
      {
        shippedAt:
          new Date(),
      },
    );
  }

  async receiveAtHub(
    returnId: string,
    actorUserId: string,
    note?: string,
  ) {
    return this.changeStatus(
      returnId,
      actorUserId,
      ReturnStatus.RECEIVED_AT_HUB,
      [
        ReturnStatus.IN_TRANSIT,
        ReturnStatus.AUTHORIZED,
      ],
      note ||
        'Devolução recebida no HUB.',
      {
        receivedAt:
          new Date(),
      },
    );
  }

  async startInspection(
    returnId: string,
    actorUserId: string,
    note?: string,
  ) {
    return this.changeStatus(
      returnId,
      actorUserId,
      ReturnStatus.INSPECTING,
      [
        ReturnStatus.RECEIVED_AT_HUB,
      ],
      note ||
        'Vistoria iniciada.',
    );
  }

  async inspect(
    returnId: string,
    actorUserId: string,
    dto: AdminInspectReturnDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current =
          await tx.returnRequest.findUnique(
            {
              where: {
                id: returnId,
              },
            },
          );

        if (!current) {
          throw new NotFoundException(
            'Devolução não encontrada.',
          );
        }

        const inspectionAllowedStatuses: ReturnStatus[] = [
          ReturnStatus.RECEIVED_AT_HUB,
          ReturnStatus.INSPECTING,
        ];

        if (
          !inspectionAllowedStatuses.includes(
            current.status,
          )
        ) {
          throw new ConflictException(
            'A devolução precisa estar recebida ou em vistoria.',
          );
        }

        const approved =
          dto.decision ===
            ReturnInspectionDecision.APPROVED ||
          dto.decision ===
            ReturnInspectionDecision.PARTIALLY_APPROVED;

        const nextStatus =
          approved
            ? ReturnStatus.APPROVED
            : ReturnStatus.REJECTED;

        const updated =
          await tx.returnRequest.update(
            {
              where: {
                id: returnId,
              },

              data: {
                status:
                  nextStatus,

                inspectionDecision:
                  dto.decision,

                inspectionNotes:
                  dto.notes,

                inspectedAt:
                  new Date(),

                ...(!approved
                  ? {
                      completedAt:
                        new Date(),
                    }
                  : {}),
              },
            },
          );

        await tx.returnHistory.create(
          {
            data: {
              returnRequestId:
                returnId,

              previousStatus:
                current.status,

              newStatus:
                nextStatus,

              reason:
                dto.notes ||
                `Resultado da vistoria: ${dto.decision}`,

              changedById:
                actorUserId,

              metadataJson: {
                inspectionDecision:
                  dto.decision,
              },
            },
          },
        );

        return updated;
      },
    );
  }

  async createRefundForReturn(
    returnId: string,
    actorUserId: string,
  ) {
    const request =
      await this.prisma.returnRequest.findUnique(
        {
          where: {
            id: returnId,
          },

          include: {
            order: {
              include: {
                orderGroup: {
                  include: {
                    payments: {
                      orderBy: {
                        createdAt:
                          'desc',
                      },
                    },
                  },
                },
              },
            },

            items: {
              include: {
                orderItem:
                  true,
              },
            },
          },
        },
      );

    if (!request) {
      throw new NotFoundException(
        'Devolução não encontrada.',
      );
    }

    if (
      request.status !==
      ReturnStatus.APPROVED
    ) {
      throw new ConflictException(
        'A devolução precisa estar aprovada antes do reembolso.',
      );
    }

    if (
      request.refundId
    ) {
      return this.refundsService.getRefundById(
        request.refundId,
      );
    }

    const payment =
      request.order.orderGroup
        .payments[0];

    if (!payment) {
      throw new NotFoundException(
        'Pagamento do pedido não encontrado.',
      );
    }

    let refundAmount =
      new Prisma.Decimal(0);

    for (
      const item of
      request.items
    ) {
      const unitValue =
        item.orderItem.total.div(
          item.orderItem.quantity,
        );

      refundAmount =
        refundAmount.add(
          unitValue.mul(
            item.quantity,
          ),
        );
    }

    if (
      refundAmount.lte(0)
    ) {
      throw new ConflictException(
        'Não existe valor válido para reembolso.',
      );
    }

    await this.prisma.returnRequest.update(
      {
        where: {
          id: request.id,
        },

        data: {
          status:
            ReturnStatus.REFUND_PENDING,
        },
      },
    );

    const refund =
      await this.refundsService.processRefund(
        request.buyerId,
        payment.id,
        request.orderId,
        refundAmount,
        `Devolução ${request.returnNumber} aprovada após vistoria.`,
      );

    const refundCompleted =
      refund.status ===
      RefundStatus.COMPLETED;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.returnRequest.update({
          where: {
            id: request.id,
          },

          data: {
            refundId:
              refund.id,

            status:
              refundCompleted
                ? ReturnStatus.REFUNDED
                : ReturnStatus.REFUND_PENDING,

            completedAt:
              refundCompleted
                ? new Date()
                : null,
          },
        });

        await tx.returnHistory.create({
          data: {
            returnRequestId:
              request.id,

            previousStatus:
              ReturnStatus.APPROVED,

            newStatus:
              refundCompleted
                ? ReturnStatus.REFUNDED
                : ReturnStatus.REFUND_PENDING,

            reason:
              refundCompleted
                ? 'Reembolso confirmado e vinculado à devolução.'
                : 'Reembolso iniciado e aguardando confirmação do provedor.',

            changedById:
              actorUserId,

            metadataJson: {
              refundId:
                refund.id,

              refundStatus:
                refund.status,

              amount:
                refundAmount.toString(),
            },
          },
        });

        if (refundCompleted) {
          await tx.order.update({
            where: {
              id: request.orderId,
            },

            data: {
              status:
                OrderStatus.REFUNDED,
            },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId:
                request.orderId,

              previousStatus:
                OrderStatus.RETURN_REQUESTED,

              newStatus:
                OrderStatus.REFUNDED,

              reason:
                `Devolução ${request.returnNumber} aprovada e reembolso confirmado.`,

              changedById:
                actorUserId,

              metadataJson: {
                returnRequestId:
                  request.id,

                refundId:
                  refund.id,
              },
            },
          });
        }
      },
    );

    return this.getAdminReturn(
      request.id,
    );
    }

  async syncRefundStatus(
    returnId: string,
    actorUserId?: string,
  ) {
    const request =
      await this.prisma.returnRequest.findUnique({
        where: {
          id: returnId,
        },

        include: {
          refund: true,
        },
      });

    if (!request) {
      throw new NotFoundException(
        'Devolução não encontrada.',
      );
    }

    if (!request.refundId || !request.refund) {
      throw new ConflictException(
        'Esta devolução ainda não possui reembolso vinculado.',
      );
    }

    const linkedRefund = request.refund;

    if (
      linkedRefund.status !==
      RefundStatus.COMPLETED
    ) {
      return this.getAdminReturn(
        returnId,
      );
    }

    if (
      request.status ===
      ReturnStatus.REFUNDED
    ) {
      return this.getAdminReturn(
        returnId,
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.returnRequest.update({
          where: {
            id: returnId,
          },

          data: {
            status:
              ReturnStatus.REFUNDED,

            completedAt:
              new Date(),
          },
        });

        await tx.returnHistory.create({
          data: {
            returnRequestId:
              returnId,

            previousStatus:
              request.status,

            newStatus:
              ReturnStatus.REFUNDED,

            reason:
              'Confirmação financeira do reembolso recebida.',

            changedById:
              actorUserId ||
              undefined,

            metadataJson: {
              refundId:
                request.refundId,

              refundStatus:
                linkedRefund.status,
            },
          },
        });

        const order =
          await tx.order.findUnique({
            where: {
              id:
                request.orderId,
            },

            select: {
              status: true,
            },
          });

        if (
          order &&
          order.status !==
            OrderStatus.REFUNDED
        ) {
          await tx.order.update({
            where: {
              id:
                request.orderId,
            },

            data: {
              status:
                OrderStatus.REFUNDED,
            },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId:
                request.orderId,

              previousStatus:
                order.status,

              newStatus:
                OrderStatus.REFUNDED,

              reason:
                `Reembolso da devolução ${request.returnNumber} confirmado.`,

              changedById:
                actorUserId ||
                undefined,

              metadataJson: {
                returnRequestId:
                  request.id,

                refundId:
                  request.refundId,
              },
            },
          });
        }

        return tx.returnRequest.findUnique({
          where: {
            id: returnId,
          },

          include:
            this.defaultInclude(),
        });
      },
    );
  }

  private async changeStatus(
    returnId: string,
    actorUserId: string,
    nextStatus: ReturnStatus,
    allowedCurrentStatuses: ReturnStatus[],
    reason: string,
    extraData: Prisma.ReturnRequestUpdateInput = {},
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current =
          await tx.returnRequest.findUnique(
            {
              where: {
                id: returnId,
              },
            },
          );

        if (!current) {
          throw new NotFoundException(
            'Devolução não encontrada.',
          );
        }

        if (
          !allowedCurrentStatuses.includes(
            current.status,
          )
        ) {
          throw new ConflictException(
            `Transição inválida de ${current.status} para ${nextStatus}.`,
          );
        }

        const updated =
          await tx.returnRequest.update(
            {
              where: {
                id: returnId,
              },

              data: {
                ...extraData,
                status:
                  nextStatus,
              },
            },
          );

        await tx.returnHistory.create(
          {
            data: {
              returnRequestId:
                returnId,

              previousStatus:
                current.status,

              newStatus:
                nextStatus,

              reason,

              changedById:
                actorUserId,
            },
          },
        );

        return updated;
      },
    );
  }

  private defaultInclude():
    Prisma.ReturnRequestInclude {
    return {
      order: {
        include: {
          currency: true,

          items: true,

          shipments: {
            include: {
              trackings: true,
            },
          },
        },
      },

      buyer: {
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

      carrier: true,

      returnWarehouse: true,

      refund: {
        include: {
          currency: true,
        },
      },

      items: {
        include: {
          orderItem: true,
        },
      },

      history: {
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

        orderBy: {
          createdAt:
            'asc',
        },
      },
    };
  }
}