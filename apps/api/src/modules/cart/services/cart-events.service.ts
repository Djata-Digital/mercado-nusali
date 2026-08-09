import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Eventos de domínio produzidos pelo agregado Cart.
 *
 * Manter os nomes em um único ponto evita divergências entre produtores e
 * consumidores da Outbox.
 */
export const CART_EVENT_TYPES = {
  CREATED: 'cart.created',
  ITEM_ADDED: 'cart.item_added',
  ITEM_UPDATED: 'cart.item_updated',
  ITEM_REMOVED: 'cart.item_removed',
  CLEARED: 'cart.cleared',
  RECALCULATED: 'cart.recalculated',
} as const;

export type CartRecalculationReason =
  | 'CART_CREATED'
  | 'ITEM_ADDED'
  | 'ITEM_UPDATED'
  | 'ITEM_REMOVED'
  | 'CART_CLEARED';

interface CartEventContext {
  cartId: string;
  userId: string;
}

interface CartItemAddedEvent extends CartEventContext {
  itemId: string;
  variantId: string;
  quantityAdded: number;
  resultingQuantity: number;
}

interface CartItemUpdatedEvent extends CartEventContext {
  itemId: string;
  variantId: string;
  previousQuantity: number;
  currentQuantity: number;
}

interface CartItemRemovedEvent extends CartEventContext {
  itemId: string;
  variantId: string;
  removedQuantity: number;
}

interface CartClearedEvent extends CartEventContext {
  removedItemsCount: number;
}

/**
 * CartEventsService
 *
 * Centraliza todos os eventos Outbox do carrinho.
 *
 * Regras:
 * - eventos críticos são somente persistidos na Outbox;
 * - nenhum EventEmitter é disparado durante a transação;
 * - o TransactionClient recebido pelo chamador é sempre reutilizado;
 * - payloads seguem um formato estável e versionado;
 * - cada mutação registra também que o resumo precisa ser recalculado.
 *
 * A publicação assíncrona é responsabilidade do processador global da Outbox.
 */
@Injectable()
export class CartEventsService {
  async recordCartCreated(
    tx: Prisma.TransactionClient,
    context: CartEventContext & { currencyId: string },
  ): Promise<void> {
    await this.recordEvent(tx, {
      aggregateId: context.cartId,
      eventType: CART_EVENT_TYPES.CREATED,
      payload: {
        cartId: context.cartId,
        userId: context.userId,
        currencyId: context.currencyId,
      },
    });

    await this.recordCartRecalculated(tx, context, 'CART_CREATED');
  }

  async recordItemAdded(
    tx: Prisma.TransactionClient,
    event: CartItemAddedEvent,
  ): Promise<void> {
    await this.recordEvent(tx, {
      aggregateId: event.cartId,
      eventType: CART_EVENT_TYPES.ITEM_ADDED,
      payload: event,
    });

    await this.recordCartRecalculated(tx, event, 'ITEM_ADDED');
  }

  async recordItemUpdated(
    tx: Prisma.TransactionClient,
    event: CartItemUpdatedEvent,
  ): Promise<void> {
    await this.recordEvent(tx, {
      aggregateId: event.cartId,
      eventType: CART_EVENT_TYPES.ITEM_UPDATED,
      payload: event,
    });

    await this.recordCartRecalculated(tx, event, 'ITEM_UPDATED');
  }

  async recordItemRemoved(
    tx: Prisma.TransactionClient,
    event: CartItemRemovedEvent,
  ): Promise<void> {
    await this.recordEvent(tx, {
      aggregateId: event.cartId,
      eventType: CART_EVENT_TYPES.ITEM_REMOVED,
      payload: event,
    });

    await this.recordCartRecalculated(tx, event, 'ITEM_REMOVED');
  }

  async recordCartCleared(
    tx: Prisma.TransactionClient,
    event: CartClearedEvent,
  ): Promise<void> {
    await this.recordEvent(tx, {
      aggregateId: event.cartId,
      eventType: CART_EVENT_TYPES.CLEARED,
      payload: event,
    });

    await this.recordCartRecalculated(tx, event, 'CART_CLEARED');
  }

  async recordCartRecalculated(
    tx: Prisma.TransactionClient,
    context: CartEventContext,
    reason: CartRecalculationReason,
  ): Promise<void> {
    await this.recordEvent(tx, {
      aggregateId: context.cartId,
      eventType: CART_EVENT_TYPES.RECALCULATED,
      payload: {
        cartId: context.cartId,
        userId: context.userId,
        reason,
      },
    });
  }

  private async recordEvent(
    tx: Prisma.TransactionClient,
    input: {
      aggregateId: string;
      eventType: string;
      payload: object;
    },
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: 'Cart',
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payloadJson: {
          eventVersion: 1,
          ...input.payload,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
