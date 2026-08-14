import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  SupportMessageSenderType,
  SupportTicketStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import {
  AdminSupportListQueryDto,
  CreateSupportTicketDto,
} from './dto/support.dto';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  private generateTicketNumber() {
    const date =
      new Date();

    const stamp =
      `${date.getUTCFullYear()}${String(
        date.getUTCMonth() + 1,
      ).padStart(2, '0')}${String(
        date.getUTCDate(),
      ).padStart(2, '0')}`;

    const random =
      Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    return `SUP-${stamp}-${random}`;
  }

  private includeDetails():
    Prisma.SupportTicketInclude {
    return {
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          phoneCode: true,
        },
      },

      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },

      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          currency: true,
        },
      },

      returnRequest: {
        select: {
          id: true,
          returnNumber: true,
          status: true,
        },
      },

      messages: {
        orderBy: {
          createdAt: 'asc',
        },

        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },

      history: {
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
    };
  }

  async createTicket(
    requesterId: string,
    dto: CreateSupportTicketDto,
  ) {
    if (dto.orderId) {
      const order =
        await this.prisma.order.findUnique({
          where: {
            id: dto.orderId,
          },

          select: {
            id: true,
            userId: true,
          },
        });

      if (!order) {
        throw new NotFoundException(
          'Pedido não encontrado.',
        );
      }

      if (
        order.userId !==
        requesterId
      ) {
        throw new ForbiddenException(
          'Você não pode vincular esse pedido ao chamado.',
        );
      }
    }

    if (dto.returnRequestId) {
      const returnRequest =
        await this.prisma.returnRequest.findUnique(
          {
            where: {
              id:
                dto.returnRequestId,
            },

            select: {
              id: true,
              buyerId: true,
            },
          },
        );

      if (!returnRequest) {
        throw new NotFoundException(
          'Devolução não encontrada.',
        );
      }

      if (
        returnRequest.buyerId !==
        requesterId
      ) {
        throw new ForbiddenException(
          'Você não pode vincular essa devolução ao chamado.',
        );
      }
    }

    let ticketNumber =
      this.generateTicketNumber();

    while (
      await this.prisma.supportTicket.findUnique(
        {
          where: {
            ticketNumber,
          },
        },
      )
    ) {
      ticketNumber =
        this.generateTicketNumber();
    }

    return this.prisma.$transaction(
      async (tx) => {
        const ticket =
          await tx.supportTicket.create(
            {
              data: {
                ticketNumber,

                requesterId,

                category:
                  dto.category,

                subject:
                  dto.subject.trim(),

                description:
                  dto.description.trim(),

                orderId:
                  dto.orderId,

                returnRequestId:
                  dto.returnRequestId,

                messages: {
                  create: {
                    senderId:
                      requesterId,

                    senderType:
                      SupportMessageSenderType.CUSTOMER,

                    message:
                      dto.description.trim(),

                    isInternal:
                      false,
                  },
                },

                history: {
                  create: {
                    newStatus:
                      SupportTicketStatus.OPEN,

                    changedById:
                      requesterId,

                    reason:
                      'Chamado aberto pelo cliente.',
                  },
                },
              },

              include:
                this.includeDetails(),
            },
          );

        return ticket;
      },
    );
  }

  async listMyTickets(
    requesterId: string,
  ) {
    return this.prisma.supportTicket.findMany(
      {
        where: {
          requesterId,
        },

        orderBy: {
          lastMessageAt:
            'desc',
        },

        include:
          this.includeDetails(),
      },
    );
  }

  async getMyTicket(
    requesterId: string,
    ticketId: string,
  ) {
    const ticket =
      await this.prisma.supportTicket.findUnique(
        {
          where: {
            id: ticketId,
          },

          include:
            this.includeDetails(),
        },
      );

    if (!ticket) {
      throw new NotFoundException(
        'Chamado não encontrado.',
      );
    }

    if (
      ticket.requesterId !==
      requesterId
    ) {
      throw new ForbiddenException(
        'Acesso negado a este chamado.',
      );
    }

    return ticket;
  }

  async addCustomerMessage(
    requesterId: string,
    ticketId: string,
    message: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const ticket =
          await tx.supportTicket.findUnique(
            {
              where: {
                id: ticketId,
              },
            },
          );

        if (!ticket) {
          throw new NotFoundException(
            'Chamado não encontrado.',
          );
        }

        if (
          ticket.requesterId !==
          requesterId
        ) {
          throw new ForbiddenException(
            'Acesso negado a este chamado.',
          );
        }

        if (
          ticket.status ===
            SupportTicketStatus.CLOSED
        ) {
          throw new ConflictException(
            'Chamados encerrados não aceitam novas mensagens.',
          );
        }

        const created =
          await tx.supportMessage.create(
            {
              data: {
                ticketId,
                senderId:
                  requesterId,
                senderType:
                  SupportMessageSenderType.CUSTOMER,
                message:
                  message.trim(),
              },
            },
          );

        await tx.supportTicket.update(
          {
            where: {
              id: ticketId,
            },

            data: {
              lastMessageAt:
                new Date(),

              status:
                ticket.status ===
                SupportTicketStatus.WAITING_CUSTOMER
                  ? SupportTicketStatus.IN_PROGRESS
                  : ticket.status,
            },
          },
        );

        return created;
      },
    );
  }

  async adminList(
    query:
      AdminSupportListQueryDto,
  ) {
    return this.prisma.supportTicket.findMany(
      {
        where: {
          ...(query.status
            ? {
                status:
                  query.status,
              }
            : {}),

          ...(query.priority
            ? {
                priority:
                  query.priority,
              }
            : {}),

          ...(query.category
            ? {
                category:
                  query.category,
              }
            : {}),
        },

        take:
          query.limit || 100,

        orderBy: [
          {
            priority:
              'desc',
          },
          {
            lastMessageAt:
              'desc',
          },
        ],

        include:
          this.includeDetails(),
      },
    );
  }

  async adminGet(
    ticketId: string,
  ) {
    const ticket =
      await this.prisma.supportTicket.findUnique(
        {
          where: {
            id: ticketId,
          },

          include:
            this.includeDetails(),
        },
      );

    if (!ticket) {
      throw new NotFoundException(
        'Chamado não encontrado.',
      );
    }

    return ticket;
  }

  async assign(
    ticketId: string,
    assignedToId: string,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const ticket =
          await tx.supportTicket.findUnique(
            {
              where: {
                id: ticketId,
              },
            },
          );

        if (!ticket) {
          throw new NotFoundException(
            'Chamado não encontrado.',
          );
        }

        const user =
          await tx.user.findUnique({
            where: {
              id:
                assignedToId,
            },

            select: {
              id: true,
              status: true,
            },
          });

        if (!user) {
          throw new NotFoundException(
            'Usuário responsável não encontrado.',
          );
        }

        const nextStatus =
          ticket.status ===
          SupportTicketStatus.OPEN
            ? SupportTicketStatus.IN_PROGRESS
            : ticket.status;

        await tx.supportTicket.update({
          where: {
            id:
              ticketId,
          },

          data: {
            assignedToId,
            status:
              nextStatus,
          },
        });

        if (
          nextStatus !==
          ticket.status
        ) {
          await tx.supportTicketHistory.create(
            {
              data: {
                ticketId,

                previousStatus:
                  ticket.status,

                newStatus:
                  nextStatus,

                changedById:
                  actorUserId,

                reason:
                  'Chamado atribuído a um agente.',
              },
            },
          );
        }

        return tx.supportTicket.findUnique(
          {
            where: {
              id: ticketId,
            },

            include:
              this.includeDetails(),
          },
        );
      },
    );
  }

  async adminReply(
    ticketId: string,
    actorUserId: string,
    message: string,
    isInternal = false,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const ticket =
          await tx.supportTicket.findUnique(
            {
              where: {
                id: ticketId,
              },
            },
          );

        if (!ticket) {
          throw new NotFoundException(
            'Chamado não encontrado.',
          );
        }

        if (
          ticket.status ===
            SupportTicketStatus.CLOSED
        ) {
          throw new ConflictException(
            'Chamado encerrado não aceita novas respostas.',
          );
        }

        const created =
          await tx.supportMessage.create(
            {
              data: {
                ticketId,

                senderId:
                  actorUserId,

                senderType:
                  SupportMessageSenderType.AGENT,

                message:
                  message.trim(),

                isInternal,
              },
            },
          );

        const now =
          new Date();

        const shouldStart =
          ticket.status ===
          SupportTicketStatus.OPEN;

        await tx.supportTicket.update({
          where: {
            id:
              ticketId,
          },

          data: {
            assignedToId:
              ticket.assignedToId ||
              actorUserId,

            firstResponseAt:
              ticket.firstResponseAt ||
              now,

            lastMessageAt:
              now,

            status:
              shouldStart
                ? SupportTicketStatus.IN_PROGRESS
                : ticket.status,
          },
        });

        if (shouldStart) {
          await tx.supportTicketHistory.create(
            {
              data: {
                ticketId,

                previousStatus:
                  SupportTicketStatus.OPEN,

                newStatus:
                  SupportTicketStatus.IN_PROGRESS,

                changedById:
                  actorUserId,

                reason:
                  'Primeira resposta do atendimento.',
              },
            },
          );
        }

        return created;
      },
    );
  }

  async updateStatus(
    ticketId: string,
    status:
      SupportTicketStatus,
    actorUserId: string,
    reason?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const ticket =
          await tx.supportTicket.findUnique(
            {
              where: {
                id: ticketId,
              },
            },
          );

        if (!ticket) {
          throw new NotFoundException(
            'Chamado não encontrado.',
          );
        }

        if (
          ticket.status === status
        ) {
          return tx.supportTicket.findUnique(
            {
              where: {
                id:
                  ticketId,
              },

              include:
                this.includeDetails(),
            },
          );
        }

        const now =
          new Date();

        await tx.supportTicket.update({
          where: {
            id:
              ticketId,
          },

          data: {
            status,

            resolvedAt:
              status ===
              SupportTicketStatus.RESOLVED
                ? now
                : ticket.resolvedAt,

            closedAt:
              status ===
              SupportTicketStatus.CLOSED
                ? now
                : ticket.closedAt,
          },
        });

        await tx.supportTicketHistory.create(
          {
            data: {
              ticketId,

              previousStatus:
                ticket.status,

              newStatus:
                status,

              changedById:
                actorUserId,

              reason:
                reason ||
                `Status alterado para ${status}.`,
            },
          },
        );

        return tx.supportTicket.findUnique(
          {
            where: {
              id:
                ticketId,
            },

            include:
              this.includeDetails(),
          },
        );
      },
    );
  }

  async updatePriority(
    ticketId: string,
    priority: any,
  ) {
    const exists =
      await this.prisma.supportTicket.findUnique(
        {
          where: {
            id: ticketId,
          },

          select: {
            id: true,
          },
        },
      );

    if (!exists) {
      throw new NotFoundException(
        'Chamado não encontrado.',
      );
    }

    return this.prisma.supportTicket.update(
      {
        where: {
          id: ticketId,
        },

        data: {
          priority,
        },

        include:
          this.includeDetails(),
      },
    );
  }
}