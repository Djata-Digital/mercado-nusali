import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

import { CouponService } from '../../coupons/coupon.service';
import { CartStoreReference } from '../../cart/interfaces/cart-summary.interface';
import {
  ShippingCalculationService,
  ShippingOption,
} from '../shipping/shipping-calculation.service';

interface PreviewAddress {
  id: string;
  countryId: string;
  postalCode?: string | null;
}

interface PreviewCartItem {
  id: string;
  productId: string;
  storeId: string;
  quantity: number;
  unitPriceSnapshot: Prisma.Decimal;
  pricing?: {
    currentUnitPrice: Prisma.Decimal;
  };
}

interface PreviewStoreGroup {
  store: CartStoreReference;
  subtotal: Prisma.Decimal;
  weightKg: Prisma.Decimal;
  volumeM3: Prisma.Decimal;
}

interface PreviewCart {
  id: string;
  currencyId: string;
  items: PreviewCartItem[];
  stores: PreviewStoreGroup[];
  summary: {
    subtotal: Prisma.Decimal;
    totalWeightKg: Prisma.Decimal;
    totalVolumeM3: Prisma.Decimal;
  };
}

export interface BuildCheckoutPreviewInput {
  userId: string;
  cart: PreviewCart;
  address: PreviewAddress;
  couponCode?: string;
}

/**
 * CheckoutPreviewService
 *
 * Responsável somente por montar a fotografia comercial do checkout:
 * cupom, cotações, estimativa de imposto, snapshots e payloadHash.
 *
 * Não cria pedido, não reserva estoque e não altera o carrinho.
 */
@Injectable()
export class CheckoutPreviewService {
  constructor(
    private readonly couponService: CouponService,
    private readonly shippingService: ShippingCalculationService,
  ) {}

  async build(input: BuildCheckoutPreviewInput) {
    const couponData = await this.validateCoupon(input);
    const shippingQuotes = await this.calculateShippingQuotes(input);
    // Não inventar imposto. Até existir motor fiscal configurado,
    // o checkout persiste zero e não cobra tributo estimado fictício.
    const estimatedTax = new Prisma.Decimal(0);
    const discount = new Prisma.Decimal(couponData?.discountAmount ?? 0);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const itemsSnapshot = input.cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      storeId: item.storeId,
      quantity: item.quantity,
      unitPriceSnapshot: (
        item.pricing?.currentUnitPrice ?? item.unitPriceSnapshot
      ).toString(),
    }));

    const payloadHash = this.createConfirmationPayloadHash({
      cart: input.cart,
      addressId: input.address.id,
      discount: discount.toString(),
      shippingQuotes,
    });

    return {
      couponData,
      shippingQuotes,
      estimatedTax,
      discount,
      expiresAt,
      payloadHash,
      itemsSnapshot,
      pricingSnapshot: {
        subtotal: input.cart.summary.subtotal.toString(),
        discountAmount: discount.toString(),
        estimatedTaxAmount: estimatedTax.toString(),
        totalWeightKg: input.cart.summary.totalWeightKg.toString(),
        totalVolumeM3: input.cart.summary.totalVolumeM3.toString(),
      },
      estimatedTaxesSnapshot: {
        source: 'NOT_CONFIGURED',
        amount: estimatedTax.toString(),
      },
      couponSnapshot: couponData
        ? {
            code: couponData.coupon.code,
            discount: discount.toString(),
            isFreeShipping: couponData.isFreeShipping,
          }
        : undefined,
    };
  }


  /**
   * Recria o hash comercial usado para detectar alterações entre o preview e
   * a confirmação. O método é público para que a confirmação use exatamente
   * o mesmo contrato, sem duplicar a canonicalização.
   */
  createConfirmationPayloadHash(input: {
    cart: PreviewCart;
    addressId: string;
    discount: string;
    shippingQuotes: unknown;
  }): string {
    const items = input.cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      storeId: item.storeId,
      quantity: item.quantity,
      unitPriceSnapshot: (
        item.pricing?.currentUnitPrice ?? item.unitPriceSnapshot
      ).toString(),
    }));

    return this.createPayloadHash({
      cartId: input.cart.id,
      addressId: input.addressId,
      items,
      discount: input.discount,
      shippingQuotes: input.shippingQuotes,
    });
  }

  private validateCoupon(input: BuildCheckoutPreviewInput) {
    if (!input.couponCode) return Promise.resolve(null);

    return this.couponService.validateCoupon(
      input.couponCode,
      input.userId,
      input.cart.summary.subtotal.toNumber(),
      input.cart.stores.map((group) => group.store.id),
      input.cart.items.map((item) => item.productId),
    );
  }

  private async calculateShippingQuotes(input: BuildCheckoutPreviewInput) {
    const quotes: Record<string, ShippingOption[]> = {};

    for (const group of input.cart.stores) {
      const store = group.store;
      quotes[store.id] = await this.shippingService.calculateShippingOptions({
        originCountryId: store.countryId || input.address.countryId,
        destinationCountryId: input.address.countryId,
        postalCode: input.address.postalCode || undefined,
        storeId: store.id,
        totalWeightKg: group.weightKg.toNumber(),
        totalVolumeM3: group.volumeM3.toNumber(),
        subtotal: group.subtotal.toNumber(),
        currencyId: input.cart.currencyId,
      });
    }

    return quotes;
  }

  private createPayloadHash(payload: unknown): string {
    return crypto
      .createHash('sha256')
      .update(this.canonicalStringify(payload))
      .digest('hex');
  }

  private canonicalStringify(value: unknown): string {
    return JSON.stringify(this.sortRecursively(value));
  }

  private sortRecursively(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortRecursively(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.sortRecursively(
            (value as Record<string, unknown>)[key],
          );
          return result;
        }, {});
    }

    return value;
  }
}
