import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  ProductVariantStatus,
  SellerStatus,
  StoreStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CartStockService, CartStockStatus } from './cart-stock.service';

/**
 * Relações necessárias para validar uma variante antes de adicioná-la ao
 * carrinho. A tipagem centralizada evita o uso de `any` no CartService.
 */
export const sellableVariantArgs =
  Prisma.validator<Prisma.ProductVariantDefaultArgs>()({
    include: {
      currency: true,
      inventoryItems: { include: { warehouse: true } },
      product: {
        include: {
          store: {
            include: {
              seller: true,
            },
          },
        },
      },
    },
  });

export type SellableCartVariant = Prisma.ProductVariantGetPayload<
  typeof sellableVariantArgs
>;

export interface ValidateCartVariantInput {
  variantId: string;
  quantity: number;
  cartCurrencyId?: string;
}

export interface ValidatedCartVariant {
  variant: SellableCartVariant;
  availableQuantity: number;
}

type CartPrismaClient = PrismaService | Prisma.TransactionClient;

/**
 * CartValidationService
 *
 * Centraliza as regras que determinam se uma variante pode permanecer ou ser
 * incluída no carrinho.
 *
 * O parâmetro opcional `client` permite que Checkout e Cart reutilizem as
 * mesmas validações dentro da transação que protege a operação.
 */
@Injectable()
export class CartValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartStockService: CartStockService,
  ) {}

  async validateVariantForCart(
    input: ValidateCartVariantInput,
    client: CartPrismaClient = this.prisma,
  ): Promise<ValidatedCartVariant> {
    this.validatePositiveQuantity(input.quantity);

    const variant = await this.loadVariant(input.variantId, client);

    this.validateVariantStatus(variant);
    this.validateProductStatus(variant);
    this.validateStoreStatus(variant);
    this.validateSellerStatus(variant);

    if (input.cartCurrencyId) {
      this.validateCurrency(input.cartCurrencyId, variant.currencyId);
    }

    const stock = this.cartStockService.evaluate({
      inventoryItems: variant.inventoryItems,
      requestedQuantity: input.quantity,
    });

    this.validateAvailableQuantity(input.quantity, stock.availableQuantity);

    return {
      variant,
      availableQuantity: stock.availableQuantity,
    };
  }

  validatePositiveQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'A quantidade deve ser um número inteiro maior que zero.',
      );
    }
  }

  calculateAvailableQuantity(variant: SellableCartVariant): number {
    return this.cartStockService.calculateAvailableQuantity(
      variant.inventoryItems,
    );
  }

  validateAvailableQuantity(
    requestedQuantity: number,
    availableQuantity: number,
  ): void {
    this.cartStockService.assertAvailable(requestedQuantity, {
      status:
        availableQuantity > 0
          ? CartStockStatus.AVAILABLE
          : CartStockStatus.OUT_OF_STOCK,
      requestedQuantity,
      availableQuantity,
      maximumAllowedQuantity: availableQuantity,
      remainingAfterRequest: Math.max(0, availableQuantity - requestedQuantity),
      activeWarehouseCount: 0,
      isAvailable: requestedQuantity <= availableQuantity,
      isLowStock:
        availableQuantity > 0 && requestedQuantity > availableQuantity,
    });
  }

  validateCurrency(cartCurrencyId: string, variantCurrencyId: string): void {
    if (cartCurrencyId !== variantCurrencyId) {
      throw new ConflictException(
        'A moeda da variante é incompatível com a moeda do carrinho.',
      );
    }
  }

  private async loadVariant(
    variantId: string,
    client: CartPrismaClient,
  ): Promise<SellableCartVariant> {
    const variant = await client.productVariant.findUnique({
      where: { id: variantId },
      ...sellableVariantArgs,
    });

    if (!variant) {
      throw new NotFoundException(`Variante id ${variantId} não encontrada.`);
    }

    return variant;
  }

  private validateVariantStatus(variant: SellableCartVariant): void {
    if (
      variant.status !== ProductVariantStatus.ACTIVE ||
      variant.deletedAt !== null
    ) {
      throw new BadRequestException(
        'A variante está inativa ou indisponível para venda.',
      );
    }
  }

  private validateProductStatus(variant: SellableCartVariant): void {
    if (
      variant.product.status !== ProductStatus.APPROVED ||
      variant.product.deletedAt !== null
    ) {
      throw new BadRequestException(
        'O produto está inativo ou indisponível para venda.',
      );
    }
  }

  private validateStoreStatus(variant: SellableCartVariant): void {
    const store = variant.product.store;

    if (store.status !== StoreStatus.ACTIVE || store.deletedAt !== null) {
      throw new BadRequestException('A loja está indisponível para vendas.');
    }
  }

  private validateSellerStatus(variant: SellableCartVariant): void {
    const seller = variant.product.store.seller;

    if (seller.status !== SellerStatus.VERIFIED || seller.deletedAt !== null) {
      throw new BadRequestException(
        'O vendedor não está autorizado a realizar vendas.',
      );
    }
  }
}
