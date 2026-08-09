import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CartEventsService } from './services/cart-events.service';
import { CartPricingService } from './services/cart-pricing.service';
import { CartSummaryService } from './services/cart-summary.service';
import { CartTransactionService } from './services/cart-transaction.service';
import { CartValidationService } from './services/cart-validation.service';

export interface AddCartItemInput {
  variantId: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

/**
 * Include compartilhado por todas as leituras do agregado Cart.
 *
 * Mantê-lo fora da classe também permite reutilizar sua tipagem nos testes e
 * evita que algum método carregue uma versão incompleta do carrinho.
 */
const cartInclude = Prisma.validator<Prisma.CartDefaultArgs>()({
  include: {
    items: {
      include: {
        product: { include: { store: true } },
        variant: {
          include: {
            inventoryItems: { include: { warehouse: true } },
          },
        },
        store: true,
        currency: true,
      },
    },
    coupon: true,
    currency: true,
  },
});

export type LoadedCart = Prisma.CartGetPayload<typeof cartInclude>;

/**
 * CartService
 *
 * Application Service responsável apenas por orquestrar o agregado Cart.
 *
 * As regras são delegadas para:
 * - CartValidationService: elegibilidade comercial;
 * - CartPricingService: preço regular, promocional e atacado;
 * - CartSummaryService: totais e agrupamento por loja;
 * - CartEventsService: eventos Outbox;
 * - CartTransactionService: atomicidade, isolamento e retry.
 */
@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartEventsService: CartEventsService,
    private readonly cartPricingService: CartPricingService,
    private readonly cartSummaryService: CartSummaryService,
    private readonly cartTransactionService: CartTransactionService,
    private readonly cartValidationService: CartValidationService,
  ) {}

  async getOrCreateCart(userId: string) {
    const existing = await this.loadActiveCart(this.prisma, userId);

    if (existing) {
      return this.cartSummaryService.buildSummary(existing);
    }

    const defaultCurrency = await this.findDefaultCurrency();

    await this.cartTransactionService.run(async (tx) => {
      // A releitura dentro da transação torna a criação idempotente quando duas
      // requisições tentam abrir o carrinho ao mesmo tempo.
      const concurrentCart = await this.loadActiveCart(tx, userId);
      if (concurrentCart) return concurrentCart;

      const createdCart = await tx.cart.create({
        data: {
          userId,
          currencyId: defaultCurrency.id,
          status: CartStatus.ACTIVE,
        },
        ...cartInclude,
      });

      await this.cartEventsService.recordCartCreated(tx, {
        cartId: createdCart.id,
        userId,
        currencyId: createdCart.currencyId,
      });

      return createdCart;
    });

    return this.getRequiredActiveCartSummary(userId);
  }

  async addItem(userId: string, input: AddCartItemInput) {
    this.cartValidationService.validatePositiveQuantity(input.quantity);
    await this.ensureCartExists(userId);

    await this.cartTransactionService.run(async (tx) => {
      const cart = await this.loadRequiredActiveCart(tx, userId);
      const existingItem = cart.items.find(
        (item) => item.variantId === input.variantId,
      );
      const resultingQuantity =
        (existingItem?.quantity ?? 0) + input.quantity;

      const { variant } =
        await this.cartValidationService.validateVariantForCart(
          {
            variantId: input.variantId,
            quantity: resultingQuantity,
            cartCurrencyId: cart.currencyId,
          },
          tx,
        );

      const pricing = this.cartPricingService.resolveUnitPrice(
        variant,
        resultingQuantity,
      );

      const savedItem = existingItem
        ? await tx.cartItem.update({
            where: { id: existingItem.id },
            data: {
              quantity: resultingQuantity,
              unitPriceSnapshot: pricing.currentUnitPrice,
              currencyId: variant.currencyId,
            },
          })
        : await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: variant.productId,
              variantId: variant.id,
              storeId: variant.product.storeId,
              quantity: resultingQuantity,
              unitPriceSnapshot: pricing.currentUnitPrice,
              currencyId: variant.currencyId,
            },
          });

      await this.cartEventsService.recordItemAdded(tx, {
        userId,
        cartId: cart.id,
        itemId: savedItem.id,
        variantId: variant.id,
        quantityAdded: input.quantity,
        resultingQuantity,
      });
    });

    return this.getRequiredActiveCartSummary(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    input: UpdateCartItemInput,
  ) {
    if (input.quantity <= 0) {
      return this.removeItem(userId, itemId);
    }

    this.cartValidationService.validatePositiveQuantity(input.quantity);

    await this.cartTransactionService.run(async (tx) => {
      const cart = await this.loadRequiredActiveCart(tx, userId);
      const existingItem = this.findCartItemOrThrow(cart, itemId);

      const { variant } =
        await this.cartValidationService.validateVariantForCart(
          {
            variantId: existingItem.variantId,
            quantity: input.quantity,
            cartCurrencyId: cart.currencyId,
          },
          tx,
        );

      const pricing = this.cartPricingService.resolveUnitPrice(
        variant,
        input.quantity,
      );

      await tx.cartItem.update({
        where: { id: itemId },
        data: {
          quantity: input.quantity,
          unitPriceSnapshot: pricing.currentUnitPrice,
          currencyId: variant.currencyId,
        },
      });

      await this.cartEventsService.recordItemUpdated(tx, {
        userId,
        cartId: cart.id,
        itemId,
        variantId: existingItem.variantId,
        previousQuantity: existingItem.quantity,
        currentQuantity: input.quantity,
      });
    });

    return this.getRequiredActiveCartSummary(userId);
  }

  async removeItem(userId: string, itemId: string) {
    await this.cartTransactionService.run(async (tx) => {
      const cart = await this.loadRequiredActiveCart(tx, userId);
      const existingItem = this.findCartItemOrThrow(cart, itemId);

      await tx.cartItem.delete({ where: { id: itemId } });

      await this.cartEventsService.recordItemRemoved(tx, {
        userId,
        cartId: cart.id,
        itemId,
        variantId: existingItem.variantId,
        removedQuantity: existingItem.quantity,
      });
    });

    return this.getRequiredActiveCartSummary(userId);
  }

  async clearCart(userId: string) {
    await this.cartTransactionService.run(async (tx) => {
      const cart = await this.loadRequiredActiveCart(tx, userId);
      const removed = await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      await this.cartEventsService.recordCartCleared(tx, {
        userId,
        cartId: cart.id,
        removedItemsCount: removed.count,
      });
    });

    return this.getRequiredActiveCartSummary(userId);
  }

  private async ensureCartExists(userId: string): Promise<void> {
    const cart = await this.loadActiveCart(this.prisma, userId);
    if (!cart) await this.getOrCreateCart(userId);
  }

  private async getRequiredActiveCartSummary(userId: string) {
    const cart = await this.loadActiveCart(this.prisma, userId);

    if (!cart) {
      throw new NotFoundException('Carrinho ativo não encontrado.');
    }

    return this.cartSummaryService.buildSummary(cart);
  }

  private async findDefaultCurrency() {
    const currency =
      (await this.prisma.currency.findFirst({ where: { code: 'BRL' } })) ??
      (await this.prisma.currency.findFirst());

    if (!currency) {
      throw new BadRequestException('Nenhuma moeda cadastrada no sistema.');
    }

    return currency;
  }

  private findCartItemOrThrow(cart: LoadedCart, itemId: string) {
    const item = cart.items.find((candidate) => candidate.id === itemId);

    if (!item) {
      throw new NotFoundException(
        `Item de carrinho id ${itemId} não encontrado.`,
      );
    }

    return item;
  }

  private loadRequiredActiveCart(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
  ): Promise<LoadedCart> {
    return this.loadActiveCart(client, userId).then((cart) => {
      if (!cart) {
        throw new NotFoundException('Carrinho ativo não encontrado.');
      }
      return cart;
    });
  }

  private loadActiveCart(
    client: PrismaService | Prisma.TransactionClient,
    userId: string,
  ): Promise<LoadedCart | null> {
    return client.cart.findFirst({
      where: { userId, status: CartStatus.ACTIVE },
      ...cartInclude,
    });
  }
}
