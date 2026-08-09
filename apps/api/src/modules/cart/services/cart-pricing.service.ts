import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Tipos de preço atualmente suportados pelo carrinho.
 *
 * A enum é local ao domínio do carrinho para evitar uma migration apenas para
 * representar um resultado calculado e não persistido.
 */
export enum CartPriceType {
  REGULAR = 'REGULAR',
  PROMOTIONAL = 'PROMOTIONAL',
  WHOLESALE = 'WHOLESALE',
}

/**
 * Estrutura mínima de variante necessária para resolver o preço comercial.
 */
export interface PriceableCartVariant {
  price: Prisma.Decimal;
  promotionalPrice: Prisma.Decimal | null;
  wholesalePrice: Prisma.Decimal | null;
  minimumWholesaleQuantity: number | null;
}

export interface CartPriceResult {
  priceType: CartPriceType;
  originalUnitPrice: Prisma.Decimal;
  currentUnitPrice: Prisma.Decimal;
  discountPerUnit: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  hasDiscount: boolean;
  priceChanged: boolean;
  previousUnitPrice: Prisma.Decimal;
}

/**
 * CartPricingService
 *
 * Centraliza a escolha e o cálculo do preço comercial aplicado aos itens do
 * carrinho.
 *
 * Ordem de prioridade:
 * 1. preço de atacado, quando a quantidade mínima é atendida;
 * 2. preço promocional válido;
 * 3. preço regular.
 *
 * Regras:
 * - usa Prisma.Decimal em todos os cálculos monetários;
 * - não persiste valores;
 * - não altera produto, variante ou carrinho;
 * - considera promocional/atacado apenas quando inferiores ao preço regular;
 * - permite detectar mudança em relação ao snapshot salvo no CartItem.
 */
@Injectable()
export class CartPricingService {
  private readonly zero = new Prisma.Decimal(0);

  /**
   * Resolve o preço unitário atual para a variante e quantidade informadas.
   */
  resolveUnitPrice(
    variant: PriceableCartVariant,
    quantity: number,
  ): Pick<CartPriceResult, 'priceType' | 'originalUnitPrice' | 'currentUnitPrice'> {
    const regularPrice = new Prisma.Decimal(variant.price);

    if (
      variant.wholesalePrice !== null &&
      variant.minimumWholesaleQuantity !== null &&
      quantity >= variant.minimumWholesaleQuantity
    ) {
      const wholesalePrice = new Prisma.Decimal(variant.wholesalePrice);

      if (wholesalePrice.gt(0) && wholesalePrice.lt(regularPrice)) {
        return {
          priceType: CartPriceType.WHOLESALE,
          originalUnitPrice: regularPrice,
          currentUnitPrice: wholesalePrice,
        };
      }
    }

    if (variant.promotionalPrice !== null) {
      const promotionalPrice = new Prisma.Decimal(variant.promotionalPrice);

      if (promotionalPrice.gt(0) && promotionalPrice.lt(regularPrice)) {
        return {
          priceType: CartPriceType.PROMOTIONAL,
          originalUnitPrice: regularPrice,
          currentUnitPrice: promotionalPrice,
        };
      }
    }

    return {
      priceType: CartPriceType.REGULAR,
      originalUnitPrice: regularPrice,
      currentUnitPrice: regularPrice,
    };
  }

  /**
   * Calcula preço, descontos, subtotal e mudança em relação ao snapshot.
   */
  calculateItemPrice(
    variant: PriceableCartVariant,
    quantity: number,
    unitPriceSnapshot: Prisma.Decimal,
  ): CartPriceResult {
    const resolved = this.resolveUnitPrice(variant, quantity);
    const previousUnitPrice = new Prisma.Decimal(unitPriceSnapshot);
    const discountPerUnit = Prisma.Decimal.max(
      this.zero,
      resolved.originalUnitPrice.minus(resolved.currentUnitPrice),
    );

    return {
      ...resolved,
      previousUnitPrice,
      discountPerUnit,
      discountTotal: discountPerUnit.mul(quantity),
      subtotal: resolved.currentUnitPrice.mul(quantity),
      hasDiscount: discountPerUnit.gt(0),
      priceChanged: !previousUnitPrice.equals(resolved.currentUnitPrice),
    };
  }
}
