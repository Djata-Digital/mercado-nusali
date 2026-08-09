import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  CheckoutSessionStatus,
  type Order,
  OrderGroupStatus,
  OrderStatus,
  Prisma,
  ProductStatus,
  ProductVariantStatus,
  SellerStatus,
  StockReservationStatus,
  StoreStatus,
  WarehouseStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

import { CartSummaryService } from '../../cart/services/cart-summary.service';
import { CheckoutEventsService } from './checkout-events.service';
import { CheckoutPreviewService } from './checkout-preview.service';
import {
  CheckoutShippingSelectionInput,
  CheckoutShippingSelectionService,
} from './checkout-shipping-selection.service';
import { CheckoutTransactionService } from './checkout-transaction.service';

export interface ConfirmCheckoutCommand {
  checkoutSessionId: string;
  shippingSelections?:
    | CheckoutShippingSelectionInput[]
    | Record<string, { serviceCode: string }>;
}

const confirmationSessionArgs = Prisma.validator<Prisma.CheckoutSessionDefaultArgs>()({
  include: {
    address: { include: { country: true } },
    coupon: true,
    currency: true,
    orderGroups: {
      include: {
        orders: true,
        stockReservations: { include: { items: true } },
      },
    },
    cart: {
      include: {
        coupon: true,
        currency: true,
        items: {
          include: {
            store: true,
            currency: true,
            product: {
              include: {
                images: true,
                store: { include: { seller: true } },
              },
            },
            variant: {
              include: {
                inventoryItems: { include: { warehouse: true } },
              },
            },
          },
        },
      },
    },
  },
});

type ConfirmationSession = Prisma.CheckoutSessionGetPayload<
  typeof confirmationSessionArgs
>;

type ConfirmationCartItem = ConfirmationSession['cart']['items'][number];

interface StoreOrderGroup {
  storeId: string;
  store: ConfirmationCartItem['product']['store'];
  items: ConfirmationCartItem[];
  subtotal: Prisma.Decimal;
}

/**
 * CheckoutConfirmationService
 *
 * Responsável pela confirmação transacional do checkout.
 *
 * A operação inteira ocorre em uma transação Serializable:
 * - revalidação comercial do carrinho;
 * - verificação do payloadHash;
 * - trava idempotente da CheckoutSession;
 * - criação de OrderGroup e Orders;
 * - reserva distribuída de estoque;
 * - snapshots, históricos e eventos Outbox;
 * - conversão do carrinho.
 */
@Injectable()
export class CheckoutConfirmationService {
  private readonly zero = new Prisma.Decimal(0);

  constructor(
    private readonly cartSummaryService: CartSummaryService,
    private readonly checkoutEventsService: CheckoutEventsService,
    private readonly checkoutPreviewService: CheckoutPreviewService,
    private readonly shippingSelectionService: CheckoutShippingSelectionService,
    private readonly checkoutTransactionService: CheckoutTransactionService,
  ) {}

  async confirm(userId: string, command: ConfirmCheckoutCommand) {
    const result = await this.checkoutTransactionService.run(async (tx) => {
      const session = await tx.checkoutSession.findUnique({
        where: { id: command.checkoutSessionId },
        ...confirmationSessionArgs,
      });

      if (!session) {
        throw new NotFoundException(
          `Sessão de checkout id ${command.checkoutSessionId} não encontrada.`,
        );
      }

      if (session.userId !== userId) {
        throw new BadRequestException(
          'Esta sessão de checkout pertence a outro usuário.',
        );
      }

      if (session.status === CheckoutSessionStatus.CONFIRMED) {
        const existing = session.orderGroups[0];
        if (!existing) {
          throw new ConflictException({
            statusCode: 409,
            message:
              'A sessão está confirmada, mas o grupo de pedidos não foi localizado.',
            errorCode: 'CHECKOUT_CONFIRMATION_INCONSISTENT',
          });
        }

        return {
          kind: 'completed' as const,
          value: {
            orderGroup: existing,
            orders: existing.orders,
            stockReservation: existing.stockReservations[0] ?? null,
          },
        };
      }

      if (session.status !== CheckoutSessionStatus.CREATED) {
        throw new ConflictException({
          statusCode: 409,
          message: `Sessão de checkout com status ${session.status} não pode ser confirmada.`,
          errorCode: 'CHECKOUT_SESSION_NOT_CONFIRMABLE',
        });
      }

      if (session.expiresAt <= new Date()) {
        const expired = await tx.checkoutSession.updateMany({
          where: {
            id: session.id,
            status: CheckoutSessionStatus.CREATED,
          },
          data: { status: CheckoutSessionStatus.EXPIRED },
        });

        if (expired.count > 0) {
          await this.checkoutEventsService.recordCheckoutExpired(tx, {
            userId,
            checkoutSessionId: session.id,
            cartId: session.cartId,
          });
        }

        return { kind: 'expired' as const };
      }

      this.validateCommercialState(session);

      const currentCart = this.cartSummaryService.buildSummary(session.cart);
      const pricingSnapshot = this.parseObject(session.pricingSnapshotJson);
      const currentPayloadHash =
        this.checkoutPreviewService.createConfirmationPayloadHash({
          cart: currentCart,
          addressId: session.addressId,
          discount: String(pricingSnapshot.discountAmount ?? '0'),
          shippingQuotes: session.shippingQuotesJson,
        });

      if (currentPayloadHash !== session.payloadHash) {
        throw new ConflictException({
          statusCode: 409,
          message:
            'O carrinho foi alterado após o início do checkout. Inicie uma nova sessão.',
          errorCode: 'CHECKOUT_PAYLOAD_CHANGED',
        });
      }

      const storeGroups = this.groupItemsByStore(
        session.cart.items,
        currentCart.items,
      );
      const shippingSelections = this.shippingSelectionService.resolve({
        storeIds: storeGroups.map((group) => group.storeId),
        shippingQuotesJson: session.shippingQuotesJson,
        selections: command.shippingSelections,
      });

      const claimed = await tx.checkoutSession.updateMany({
        where: {
          id: session.id,
          status: CheckoutSessionStatus.CREATED,
          expiresAt: { gt: new Date() },
        },
        data: {
          status: CheckoutSessionStatus.CONFIRMED,
          confirmedAt: new Date(),
          shippingSelectionsJson: shippingSelections.map((selection) => ({
            ...selection,
            cost: selection.cost.toString(),
          })) as Prisma.InputJsonValue,
        },
      });

      if (claimed.count === 0) {
        const concurrent = await tx.orderGroup.findFirst({
          where: { checkoutSessionId: session.id },
          include: {
            orders: true,
            stockReservations: { include: { items: true } },
          },
        });

        if (concurrent) {
          return {
            kind: 'completed' as const,
            value: {
              orderGroup: concurrent,
              orders: concurrent.orders,
              stockReservation: concurrent.stockReservations[0] ?? null,
            },
          };
        }

        throw new ConflictException({
          statusCode: 409,
          message: 'O checkout já está sendo confirmado por outra requisição.',
          errorCode: 'CHECKOUT_ALREADY_PROCESSING',
        });
      }

      const discountAmount = new Prisma.Decimal(
        String(pricingSnapshot.discountAmount ?? '0'),
      );
      const taxAmount = new Prisma.Decimal(
        String(pricingSnapshot.estimatedTaxAmount ?? '0'),
      );
      const subtotal = currentCart.summary.subtotal;
      const shippingAmount = shippingSelections.reduce(
        (total, selection) => total.plus(selection.cost),
        this.zero,
      );
      const total = subtotal
        .minus(discountAmount)
        .plus(taxAmount)
        .plus(shippingAmount);

      const orderGroup = await tx.orderGroup.create({
        data: {
          userId,
          checkoutSessionId: session.id,
          addressSnapshotJson: this.addressSnapshot(session),
          currencyId: session.currencyId,
          subtotal,
          discountAmount,
          shippingAmount,
          estimatedTaxAmount: taxAmount,
          total,
          status: OrderGroupStatus.PENDING_PAYMENT,
        },
      });

      const reservation = await tx.stockReservation.create({
        data: {
          orderGroupId: orderGroup.id,
          userId,
          status: StockReservationStatus.ACTIVE,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const orders: Order[] = [];

      for (const group of storeGroups) {
        const shipping = shippingSelections.find(
          (selection) => selection.storeId === group.storeId,
        );
        if (!shipping) {
          throw new BadRequestException(
            `Frete não resolvido para a loja ${group.storeId}.`,
          );
        }

        const ratio = subtotal.gt(0)
          ? group.subtotal.div(subtotal)
          : this.zero;
        const storeDiscount = discountAmount.mul(ratio);
        const storeTax = taxAmount.mul(ratio);
        const storeTotal = group.subtotal
          .minus(storeDiscount)
          .plus(storeTax)
          .plus(shipping.cost);
        const seller = group.store.seller;
        const orderNumber = this.generateOrderNumber();

        const order = await tx.order.create({
          data: {
            orderNumber,
            orderGroupId: orderGroup.id,
            userId,
            sellerId: seller.id,
            storeId: group.store.id,
            currencyId: session.currencyId,
            subtotal: group.subtotal,
            discountAmount: storeDiscount,
            shippingAmount: shipping.cost,
            estimatedTaxAmount: storeTax,
            total: storeTotal,
            status: OrderStatus.PENDING_PAYMENT,
            shippingServiceCode: shipping.serviceCode,
            shippingServiceName: shipping.serviceName,
            estimatedDeliveryMinDays: shipping.estimatedMinDays,
            estimatedDeliveryMaxDays: shipping.estimatedMaxDays,
            addressSnapshotJson: this.addressSnapshot(session),
            storeSnapshotJson: {
              id: group.store.id,
              name: group.store.name,
              slug: group.store.slug,
            },
            sellerSnapshotJson: {
              id: seller.id,
              legalName: seller.legalName,
              tradeName: seller.tradeName,
            },
            couponSnapshotJson: session.couponSnapshotJson ?? undefined,
            placedAt: new Date(),
          },
        });

        for (const cartItem of group.items) {
          const enriched = currentCart.items.find(
            (item) => item.id === cartItem.id,
          );
          if (!enriched) {
            throw new ConflictException('Item atual do carrinho não localizado.');
          }

          const product = cartItem.product;
          const variant = cartItem.variant;
          const itemSubtotal = enriched.pricing.currentUnitPrice.mul(
            cartItem.quantity,
          );

          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              variantId: variant.id,
              productTitleSnapshot: product.title,
              variantNameSnapshot: variant.name,
              skuSnapshot: variant.sku,
              imageKeySnapshot:
                product.images.find((image) => image.isMain)?.fileKey ??
                product.images[0]?.fileKey ??
                null,
              quantity: cartItem.quantity,
              unitPrice: enriched.pricing.currentUnitPrice,
              subtotal: itemSubtotal,
              discountAmount: this.zero,
              total: itemSubtotal,
              currencyId: session.currencyId,
            },
          });

          await this.reserveInventory(tx, {
            reservationId: reservation.id,
            orderItemId: orderItem.id,
            variantId: variant.id,
            quantity: cartItem.quantity,
            inventoryItems: variant.inventoryItems,
            productTitle: product.title,
          });
        }

        await this.createOrderSnapshots(tx, {
          orderId: order.id,
          userId,
          session,
          subtotal: group.subtotal,
          discountAmount: storeDiscount,
          shippingAmount: shipping.cost,
          taxAmount: storeTax,
          totalAmount: storeTotal,
          shipping,
          orderNumber,
        });

        await this.checkoutEventsService.recordOrderCreated(tx, {
          userId,
          orderId: order.id,
          orderNumber,
          total: storeTotal,
        });

        orders.push(order);
      }

      const converted = await tx.cart.updateMany({
        where: { id: session.cartId, status: CartStatus.ACTIVE },
        data: { status: CartStatus.CONVERTED },
      });

      if (converted.count === 0) {
        throw new ConflictException({
          statusCode: 409,
          message: 'O carrinho já foi convertido ou deixou de estar ativo.',
          errorCode: 'CHECKOUT_CART_NOT_ACTIVE',
        });
      }

      await this.checkoutEventsService.recordCheckoutCompleted(tx, {
        userId,
        checkoutSessionId: session.id,
        orderGroupId: orderGroup.id,
      });
      await this.checkoutEventsService.recordReservationCreated(tx, {
        userId,
        reservationId: reservation.id,
        orderGroupId: orderGroup.id,
      });

      return {
        kind: 'completed' as const,
        value: { orderGroup, orders, stockReservation: reservation },
      };
    });

    if (result.kind === 'expired') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'A sessão de checkout expirou. Inicie um novo checkout.',
        errorCode: 'CHECKOUT_SESSION_EXPIRED',
      });
    }

    return result.value;
  }

  private validateCommercialState(session: ConfirmationSession): void {
    if (session.cart.status !== CartStatus.ACTIVE) {
      throw new ConflictException('O carrinho não está mais ativo.');
    }

    if (session.cart.items.length === 0) {
      throw new BadRequestException('O carrinho está vazio.');
    }

    for (const item of session.cart.items) {
      const product = item.product;
      const variant = item.variant;
      const store = product.store;
      const seller = store.seller;

      if (product.status !== ProductStatus.APPROVED || product.deletedAt) {
        throw new BadRequestException(
          `O produto '${product.title}' não está disponível.`,
        );
      }
      if (
        variant.status !== ProductVariantStatus.ACTIVE ||
        variant.deletedAt
      ) {
        throw new BadRequestException(
          `A variante '${variant.sku}' não está disponível.`,
        );
      }
      if (store.status !== StoreStatus.ACTIVE || store.deletedAt) {
        throw new BadRequestException(
          `A loja '${store.name}' não está disponível.`,
        );
      }
      if (seller.status !== SellerStatus.VERIFIED || seller.deletedAt) {
        throw new BadRequestException(
          `O vendedor da loja '${store.name}' não está verificado.`,
        );
      }
      if (variant.currencyId !== session.currencyId) {
        throw new BadRequestException(
          `A moeda da variante '${variant.sku}' é incompatível com o checkout.`,
        );
      }

      const available = variant.inventoryItems
        .filter((inventory) => inventory.warehouse.status === WarehouseStatus.ACTIVE)
        .reduce((total, inventory) => total + inventory.quantityAvailable, 0);

      if (available < item.quantity) {
        throw new ConflictException(
          `Estoque insuficiente para '${product.title}'.`,
        );
      }
    }
  }

  private groupItemsByStore(
    items: ConfirmationCartItem[],
    enrichedItems: Array<{ id: string; itemSubtotal: Prisma.Decimal }>,
  ): StoreOrderGroup[] {
    const groups = new Map<string, StoreOrderGroup>();

    for (const item of items) {
      const enriched = enrichedItems.find((candidate) => candidate.id === item.id);
      if (!enriched) continue;

      const group = groups.get(item.storeId) ?? {
        storeId: item.storeId,
        store: item.product.store,
        items: [],
        subtotal: this.zero,
      };

      group.items.push(item);
      group.subtotal = group.subtotal.plus(enriched.itemSubtotal);
      groups.set(item.storeId, group);
    }

    return Array.from(groups.values());
  }

  private async reserveInventory(
    tx: Prisma.TransactionClient,
    input: {
      reservationId: string;
      orderItemId: string;
      variantId: string;
      quantity: number;
      inventoryItems: ConfirmationCartItem['variant']['inventoryItems'];
      productTitle: string;
    },
  ): Promise<void> {
    let remaining = input.quantity;
    const candidates = [...input.inventoryItems]
      .filter(
        (inventory) =>
          inventory.warehouse.status === WarehouseStatus.ACTIVE &&
          inventory.quantityAvailable > 0,
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const inventory of candidates) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, inventory.quantityAvailable);

      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: inventory.id,
          quantityAvailable: { gte: quantity },
        },
        data: {
          quantityAvailable: { decrement: quantity },
          quantityReserved: { increment: quantity },
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          `O estoque de '${input.productTitle}' foi alterado por outra compra.`,
        );
      }

      await tx.stockReservationItem.create({
        data: {
          reservationId: input.reservationId,
          orderItemId: input.orderItemId,
          variantId: input.variantId,
          warehouseId: inventory.warehouseId,
          inventoryItemId: inventory.id,
          quantity,
        },
      });

      remaining -= quantity;
    }

    if (remaining > 0) {
      throw new ConflictException(
        `Não foi possível reservar todo o estoque de '${input.productTitle}'.`,
      );
    }
  }

  private async createOrderSnapshots(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      userId: string;
      session: ConfirmationSession;
      subtotal: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      shippingAmount: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      shipping: {
        serviceCode: string;
        serviceName: string;
        cost: Prisma.Decimal;
        estimatedMinDays: number;
        estimatedMaxDays: number;
      };
      orderNumber: string;
    },
  ): Promise<void> {
    const address = input.session.address;

    await tx.orderAddressSnapshot.create({
      data: {
        orderId: input.orderId,
        recipientName: address.recipientName,
        phone: address.phone,
        street: address.street,
        number: address.number,
        complement: address.complement,
        neighborhood: address.neighborhood,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        countryId: address.countryId,
        latitude: address.latitude,
        longitude: address.longitude,
      },
    });

    await tx.orderPriceSnapshot.create({
      data: {
        orderId: input.orderId,
        subtotal: input.subtotal,
        discountAmount: input.discountAmount,
        shippingAmount: input.shippingAmount,
        taxAmount: input.taxAmount,
        totalAmount: input.totalAmount,
        currencyId: input.session.currencyId,
      },
    });

    await tx.orderShipping.create({
      data: {
        orderId: input.orderId,
        serviceCode: input.shipping.serviceCode,
        serviceName: input.shipping.serviceName,
        cost: input.shipping.cost,
        estimatedMinDays: input.shipping.estimatedMinDays,
        estimatedMaxDays: input.shipping.estimatedMaxDays,
      },
    });

    if (input.session.coupon) {
      await tx.orderCoupon.create({
        data: {
          orderId: input.orderId,
          couponId: input.session.coupon.id,
          code: input.session.coupon.code,
          type: input.session.coupon.type,
          value: input.session.coupon.value,
          amountDiscounted: input.discountAmount,
        },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: input.orderId,
        previousStatus: null,
        newStatus: OrderStatus.PENDING_PAYMENT,
        reason: 'Pedido criado pela confirmação do checkout.',
        changedById: input.userId,
      },
    });

    await tx.orderTimeline.create({
      data: {
        orderId: input.orderId,
        eventCode: 'ORDER_CREATED',
        title: 'Pedido criado',
        description: `Pedido ${input.orderNumber} aguardando pagamento.`,
        actorId: input.userId,
      },
    });
  }

  private addressSnapshot(session: ConfirmationSession): Prisma.InputJsonValue {
    const address = session.address;
    return {
      recipientName: address.recipientName,
      phone: address.phone,
      phoneCode: address.phoneCode,
      street: address.street,
      number: address.number,
      complement: address.complement,
      neighborhood: address.neighborhood,
      district: address.district,
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      countryId: address.countryId,
    } as Prisma.InputJsonValue;
  }

  private parseObject(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return value as Record<string, unknown>;
  }

  private generateOrderNumber(): string {
    return `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
}
