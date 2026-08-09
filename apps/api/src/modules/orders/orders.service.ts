import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStateMachineService } from './order-state-machine.service';
import { OrderStatus } from '@prisma/client';

export interface AddOrderCommentInput {
  comment: string;
  isPrivate?: boolean;
}

export interface AddOrderAttachmentInput {
  fileName: string;
  fileKey: string;
  mimeType: string;
  fileSize: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: OrderStateMachineService,
  ) {}

  /**
   * Consulta detalhada de um Pedido com Timeline, Comentários, Anexos, Snapshots e Itens.
   */
  async findOne(orderId: string, currentUser?: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true, variant: true } },
        addressSnapshotRelation: true,
        priceSnapshotRelation: true,
        shippingRelation: { include: { carrier: true } },
        couponRelation: true,
        taxes: true,
        timeline: { include: { actor: true }, orderBy: { createdAt: 'desc' } },
        comments: { include: { author: true }, orderBy: { createdAt: 'desc' } },
        attachments: { include: { uploadedBy: true }, orderBy: { createdAt: 'desc' } },
        statusHistory: { include: { changedBy: true }, orderBy: { createdAt: 'desc' } },
        store: true,
        seller: true,
        currency: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Pedido id ${orderId} não encontrado.`);
    }

    if (currentUser) {
      const userId = currentUser.sub || currentUser.id;
      const roles: string[] = Array.isArray(currentUser.roles) ? currentUser.roles : currentUser.role ? [currentUser.role] : [];
      const isAdmin = roles.some((r) => ['ADMIN', 'GLOBAL_ADMIN', 'LOGISTICS_ADMIN'].includes(r.toUpperCase()));

      if (!isAdmin) {
        const isBuyer = order.userId === userId;
        const isSeller = order.seller.userId === userId;
        const isStoreMember = await this.prisma.storeMember.findFirst({
          where: { userId, storeId: order.storeId, status: 'ACTIVE' },
        });

        if (!isBuyer && !isSeller && !isStoreMember) {
          throw new ForbiddenException('Acesso negado a este pedido.');
        }

        // Se for comprador (buyer), filtrar comentários privados
        if (isBuyer && !isSeller && !isStoreMember) {
          order.comments = order.comments.filter((c) => !c.isPrivate);
        }
      }
    }

    return order;
  }

  /**
   * Consulta de pedidos do Comprador (Buyer).
   */
  async findBuyerOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        store: true,
        priceSnapshotRelation: true,
        shippingRelation: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Consulta de pedidos do Vendedor (Seller/Store).
   */
  async findSellerOrders(userId: string, storeId?: string) {
    const where: any = {};
    const sellerProfile = await this.prisma.sellerProfile.findFirst({ where: { userId } });

    if (storeId) {
      const ownedStore = sellerProfile
        ? await this.prisma.store.findFirst({
            where: { id: storeId, sellerId: sellerProfile.id },
            select: { id: true },
          })
        : null;

      const membership = await this.prisma.storeMember.findFirst({
        where: { userId, storeId, status: 'ACTIVE' },
        select: { id: true },
      });

      if (!ownedStore && !membership) {
        throw new ForbiddenException('Acesso negado aos pedidos desta loja.');
      }

      where.storeId = storeId;
    } else {
      if (sellerProfile) {
        where.sellerId = sellerProfile.id;
      } else {
        const storeMembers = await this.prisma.storeMember.findMany({
          where: { userId, status: 'ACTIVE' },
          select: { storeId: true },
        });
        where.storeId = { in: storeMembers.map((sm) => sm.storeId) };
      }
    }

    return this.prisma.order.findMany({
      where,
      include: {
        items: true,
        user: true,
        priceSnapshotRelation: true,
        shippingRelation: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Consulta administrativa de pedidos com filtros operacionais.
   */
  async findAllAdmin(filters?: { status?: OrderStatus; storeId?: string; sellerId?: string; userId?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.storeId) where.storeId = filters.storeId;
    if (filters?.sellerId) where.sellerId = filters.sellerId;
    if (filters?.userId) where.userId = filters.userId;

    return this.prisma.order.findMany({
      where,
      include: {
        user: true,
        store: true,
        seller: true,
        priceSnapshotRelation: true,
        shippingRelation: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Transiciona o estado do pedido.
   */
  async updateStatus(orderId: string, newStatus: OrderStatus, reason?: string, operatorId?: string) {
    return this.stateMachine.transitionState({
      orderId,
      newStatus,
      reason,
      changedById: operatorId,
    });
  }

  /**
   * Adiciona um comentário ao pedido.
   */
  async addComment(orderId: string, authorId: string, input: AddOrderCommentInput, currentUser?: any) {
    await this.findOne(orderId, currentUser);

    const validAuthorId = authorId && authorId !== 'anonymous' ? authorId : null;

    const comment = await this.prisma.orderComment.create({
      data: {
        orderId,
        authorId: validAuthorId,
        comment: input.comment,
        isPrivate: input.isPrivate || false,
      },
      include: { author: true },
    });

    await this.prisma.orderTimeline.create({
      data: {
        orderId,
        eventCode: 'COMMENT_ADDED',
        title: 'Novo Comentário',
        description: input.comment.length > 50 ? `${input.comment.substring(0, 50)}...` : input.comment,
        actorId: validAuthorId,
      },
    });

    return comment;
  }

  /**
   * Adiciona um anexo ao pedido.
   */
  async addAttachment(orderId: string, uploaderId: string, input: AddOrderAttachmentInput, currentUser?: any) {
    await this.findOne(orderId, currentUser);

    const validUploaderId = uploaderId && uploaderId !== 'anonymous' ? uploaderId : null;

    const attachment = await this.prisma.orderAttachment.create({
      data: {
        orderId,
        uploadedById: validUploaderId,
        fileName: input.fileName,
        fileKey: input.fileKey,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      },
    });

    await this.prisma.orderTimeline.create({
      data: {
        orderId,
        eventCode: 'ATTACHMENT_ADDED',
        title: 'Anexo Adicionado',
        description: `Arquivo ${input.fileName} anexado ao pedido.`,
      },
    });

    return attachment;
  }

  /**
   * Alias de findSellerOrders para compatibilidade retroativa.
   */
  async listSellerOrders(userId: string, storeIdOrFilter?: any) {
    const storeId = typeof storeIdOrFilter === 'string' ? storeIdOrFilter : storeIdOrFilter?.storeId;
    const items = await this.findSellerOrders(userId, storeId);
    return { items, count: items.length };
  }

  /**
   * Alias de cancelamento de pedido para compatibilidade retroativa.
   */
  async cancelOrder(arg1: string, arg2?: any, arg3?: any, _arg4?: any, _arg5?: any) {
    let orderId: string;
    let reason: string | undefined;

    if (arg2 && typeof arg2 === 'string' && arg2.startsWith('ord')) {
      orderId = arg2;
      reason = typeof arg3 === 'object' ? arg3?.reason : arg3;
    } else {
      orderId = arg1;
      reason = typeof arg2 === 'string' ? arg2 : arg2?.reason;
    }

    const order = await this.updateStatus(orderId, OrderStatus.CANCELLED, reason);
    return { success: true, order };
  }
}
