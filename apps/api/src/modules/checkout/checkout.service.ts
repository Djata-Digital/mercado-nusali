import { BadRequestException, Injectable } from '@nestjs/common';
import { CheckoutSessionStatus, Prisma } from '@prisma/client';

import { CartService } from '../cart/cart.service';
import {
  CheckoutConfirmationService,
  ConfirmCheckoutCommand,
} from './services/checkout-confirmation.service';
import { CheckoutEventsService } from './services/checkout-events.service';
import { CheckoutPreviewService } from './services/checkout-preview.service';
import { CheckoutTransactionService } from './services/checkout-transaction.service';
import { CheckoutValidationService } from './services/checkout-validation.service';

export interface CreateCheckoutInput {
  addressId: string;
  couponCode?: string;
}

export type ConfirmCheckoutInput = ConfirmCheckoutCommand;

/**
 * CheckoutService
 *
 * Application Service do checkout.
 *
 * Responsabilidades:
 * - iniciar a sessão e persistir o preview comercial;
 * - delegar a confirmação transacional ao CheckoutConfirmationService.
 *
 * O serviço não implementa diretamente reserva, pedidos ou cálculo de frete.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly validationService: CheckoutValidationService,
    private readonly cartService: CartService,
    private readonly checkoutConfirmationService: CheckoutConfirmationService,
    private readonly checkoutEventsService: CheckoutEventsService,
    private readonly checkoutPreviewService: CheckoutPreviewService,
    private readonly checkoutTransactionService: CheckoutTransactionService,
  ) {}

  /**
   * Inicia uma sessão de checkout a partir do estado comercial atual do
   * carrinho e grava o evento checkout.started no mesmo commit.
   */
  async createCheckoutSession(userId: string, input: CreateCheckoutInput) {
    const cart = await this.cartService.getOrCreateCart(userId);

    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Seu carrinho está vazio.');
    }

    const { address } = await this.validationService.validateCheckout({
      userId,
      cartId: cart.id,
      addressId: input.addressId,
    });

    const preview = await this.checkoutPreviewService.build({
      userId,
      cart,
      address,
      couponCode: input.couponCode,
    });

    const session = await this.checkoutTransactionService.run(async (tx) => {
      const created = await tx.checkoutSession.create({
        data: {
          userId,
          cartId: cart.id,
          addressId: address.id,
          currencyId: cart.currencyId,
          couponId: preview.couponData?.coupon?.id || null,
          payloadHash: preview.payloadHash,
          itemsSnapshotJson: preview.itemsSnapshot as Prisma.InputJsonValue,
          pricingSnapshotJson:
            preview.pricingSnapshot as Prisma.InputJsonValue,
          shippingQuotesJson:
            preview.shippingQuotes as unknown as Prisma.InputJsonValue,
          estimatedTaxesJson:
            preview.estimatedTaxesSnapshot as Prisma.InputJsonValue,
          couponSnapshotJson: preview.couponSnapshot
            ? (preview.couponSnapshot as Prisma.InputJsonValue)
            : undefined,
          status: CheckoutSessionStatus.CREATED,
          expiresAt: preview.expiresAt,
        },
        include: { address: true, currency: true, coupon: true },
      });

      await this.checkoutEventsService.recordCheckoutStarted(tx, {
        userId,
        cartId: cart.id,
        checkoutSessionId: created.id,
        expiresAt: preview.expiresAt,
      });

      return created;
    });

    return {
      session,
      cartSummary: cart.summary,
      stores: cart.stores,
      shippingQuotes: preview.shippingQuotes,
    };
  }

  /** Confirma o checkout de forma atômica e idempotente. */
  confirmCheckout(userId: string, input: ConfirmCheckoutInput) {
    return this.checkoutConfirmationService.confirm(userId, input);
  }

  /** Alias mantido para compatibilidade com suítes e consumidores antigos. */
  confirm(
    userId: string,
    input: ConfirmCheckoutInput | string,
    _idempotencyKey?: string,
    _extra?: unknown,
  ) {
    const payload =
      typeof input === 'string' ? { checkoutSessionId: input } : input;
    return this.confirmCheckout(userId, payload);
  }
}
