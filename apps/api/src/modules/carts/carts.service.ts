import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryAvailabilityService } from '../inventory-availability/inventory-availability.service';
import { AddCartItemDto, UpdateCartItemDto, MergeCartDto, ApplyCartCouponDto } from './dto/cart.dto';
import { serializeDecimal, addDecimal, mulDecimal, subDecimal } from '../../common/utils/decimal.util';
import { ProductStatus, StoreStatus, SellerStatus, ProductVariantStatus, Prisma } from '@prisma/client';

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly inventoryAvailabilityService: InventoryAvailabilityService,
  ) {}

  /**
   * Obtém ou cria o carrinho ativo do usuário para a moeda especificada.
   * Se nenhuma moeda for especificada, utiliza a moeda padrão do usuário ou BRL/XOF.
   * Atende ao Requisito 2: Apenas um carrinho ACTIVE por usuário e moeda.
   */
  async getOrCreateActiveCart(userId: string, targetCurrencyId?: string) {
    let currencyId = targetCurrencyId;

    if (!currencyId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferredCurrencyId: true },
      });
      currencyId = user?.preferredCurrencyId || undefined;

      if (!currencyId) {
        const defaultCurrency = await this.prisma.currency.findFirst();
        if (!defaultCurrency) throw new BadRequestException('Nenhuma moeda cadastrada na plataforma.');
        currencyId = defaultCurrency.id;
      }
    }

    // Try to find active cart for user + currency
    let cart = await this.prisma.cart.findFirst({
      where: {
        userId,
        currencyId,
        status: 'ACTIVE',
      },
      include: {
        currency: true,
        coupon: true,
        items: {
          include: {
            product: true,
            variant: { include: { currency: true } },
            store: true,
          },
        },
      },
    });

    if (!cart) {
      try {
        cart = await this.prisma.cart.create({
          data: {
            userId,
            currencyId,
            status: 'ACTIVE',
          },
          include: {
            currency: true,
            coupon: true,
            items: {
              include: {
                product: true,
                variant: { include: { currency: true } },
                store: true,
              },
            },
          },
        });
      } catch (err) {
        // Enforce fallback if concurrent create occurred
        cart = (await this.prisma.cart.findFirst({
          where: { userId, currencyId, status: 'ACTIVE' },
          include: {
            currency: true,
            coupon: true,
            items: {
              include: {
                product: true,
                variant: { include: { currency: true } },
                store: true,
              },
            },
          },
        }))!;
      }
    }

    return cart;
  }

  async getCart(userId: string, currencyId?: string) {
    const cart = await this.getOrCreateActiveCart(userId, currencyId);
    return this.buildCartResponse(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto, reqInfo: any) {
    // Requirement 3 & 4: Derive variant, product, store, seller and validate
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: {
        product: {
          include: {
            store: {
              include: { seller: true },
            },
          },
        },
        currency: true,
      },
    });

    if (!variant || variant.deletedAt) {
      throw new NotFoundException('Variante de produto não encontrada.');
    }

    const product = variant.product;
    const store = product.store;
    const seller = store.seller;

    if (product.status !== ProductStatus.APPROVED || product.deletedAt) {
      throw new BadRequestException('Produto indisponível para compra.');
    }
    if (store.status !== StoreStatus.ACTIVE || store.deletedAt) {
      throw new BadRequestException('Loja inativa ou indisponível.');
    }
    if (seller.status !== SellerStatus.VERIFIED || seller.deletedAt) {
      throw new BadRequestException('Vendedor não verificado.');
    }
    if (variant.status !== ProductVariantStatus.ACTIVE || variant.deletedAt) {
      throw new BadRequestException('Variante inativa ou indisponível.');
    }

    // Wholesale check
    if (
      variant.minimumWholesaleQuantity &&
      dto.quantity < variant.minimumWholesaleQuantity
    ) {
      throw new BadRequestException(
        `Quantidade mínima para atacado nesta variante é ${variant.minimumWholesaleQuantity}.`,
      );
    }

    // Get active cart for variant currency
    const cart = await this.getOrCreateActiveCart(userId, variant.currencyId);

    // Validate single currency
    if (cart.currencyId !== variant.currencyId) {
      throw new BadRequestException('CURRENCY_MISMATCH: Todos os itens do carrinho devem estar na mesma moeda.');
    }

    // Check inventory availability
    const availableQty = await this.inventoryAvailabilityService.getAvailableQuantity(variant.id);
    if (availableQty < dto.quantity) {
      throw new BadRequestException(`Estoque insuficiente. Disponível no momento: ${availableQty}.`);
    }

    // Add or update cart item
    const currentPrice = variant.promotionalPrice || variant.price;

    await this.prisma.cartItem.upsert({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: variant.id,
        },
      },
      create: {
        cartId: cart.id,
        productId: product.id,
        variantId: variant.id,
        storeId: store.id,
        quantity: dto.quantity,
        unitPriceSnapshot: currentPrice,
        currencyId: variant.currencyId,
      },
      update: {
        quantity: { increment: dto.quantity },
        unitPriceSnapshot: currentPrice,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CART_ITEM_ADDED',
      entity: 'Cart',
      entityId: cart.id,
      newValue: { variantId: variant.id, quantity: dto.quantity },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.getCart(userId, cart.currencyId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto, reqInfo: any) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        variant: {
          include: {
            product: { include: { store: { include: { seller: true } } } },
          },
        },
      },
    });

    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException('Item do carrinho não encontrado.');
    }

    const availableQty = await this.inventoryAvailabilityService.getAvailableQuantity(item.variantId);
    if (availableQty < dto.quantity) {
      throw new BadRequestException(`Estoque insuficiente. Disponível no momento: ${availableQty}.`);
    }

    const currentPrice = item.variant.promotionalPrice || item.variant.price;

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        unitPriceSnapshot: currentPrice,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CART_ITEM_UPDATED',
      entity: 'CartItem',
      entityId: itemId,
      newValue: { quantity: dto.quantity },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.getCart(userId, item.cart.currencyId);
  }

  async removeItem(userId: string, itemId: string, reqInfo: any) {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item || item.cart.userId !== userId) {
      throw new NotFoundException('Item do carrinho não encontrado.');
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });

    await this.auditService.log({
      userId,
      action: 'CART_ITEM_REMOVED',
      entity: 'CartItem',
      entityId: itemId,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.getCart(userId, item.cart.currencyId);
  }

  async clearCart(userId: string, currencyId?: string, reqInfo?: any) {
    const cart = await this.getOrCreateActiveCart(userId, currencyId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    if (reqInfo) {
      await this.auditService.log({
        userId,
        action: 'CART_CLEARED',
        entity: 'Cart',
        entityId: cart.id,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    }

    return this.getCart(userId, cart.currencyId);
  }

  async mergeCart(userId: string, dto: MergeCartDto, reqInfo: any) {
    for (const itemDto of dto.items) {
      try {
        await this.addItem(userId, itemDto, reqInfo);
      } catch (e) {
        // Continue merging remaining items if one fails
      }
    }
    return this.getCart(userId);
  }

  async applyCoupon(userId: string, dto: ApplyCartCouponDto, reqInfo: any) {
    const couponCode = dto.code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: couponCode },
    });

    if (!coupon || coupon.deletedAt || coupon.status !== 'ACTIVE') {
      throw new BadRequestException('Cupom inválido ou inativo.');
    }

    const cart = await this.getOrCreateActiveCart(userId);

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: coupon.id },
    });

    await this.auditService.log({
      userId,
      action: 'CART_COUPON_APPLIED',
      entity: 'Cart',
      entityId: cart.id,
      newValue: { couponCode },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.getCart(userId, cart.currencyId);
  }

  async removeCoupon(userId: string, reqInfo: any) {
    const cart = await this.getOrCreateActiveCart(userId);
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { couponId: null },
    });

    await this.auditService.log({
      userId,
      action: 'CART_COUPON_REMOVED',
      entity: 'Cart',
      entityId: cart.id,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return this.getCart(userId, cart.currencyId);
  }

  public async buildCartResponse(cart: any) {
    const warnings: string[] = [];
    const storesMap = new Map<string, { store: any; items: any[]; subtotal: Prisma.Decimal }>();

    let totalSubtotal = new Prisma.Decimal(0);

    for (const item of cart.items || []) {
      const currentPrice = item.variant.promotionalPrice || item.variant.price;

      // Price changed warning
      if (!new Prisma.Decimal(item.unitPriceSnapshot).equals(currentPrice)) {
        warnings.push(`PRICE_CHANGED: O preço da variante '${item.variant.name}' foi alterado.`);
      }

      // Check stock availability
      const availableQty = await this.inventoryAvailabilityService.getAvailableQuantity(item.variantId);
      if (availableQty === 0) {
        warnings.push(`OUT_OF_STOCK: A variante '${item.variant.name}' está fora de estoque.`);
      } else if (availableQty < item.quantity) {
        warnings.push(`LOW_STOCK: A variante '${item.variant.name}' possui apenas ${availableQty} unidades disponíveis.`);
      }

      // Product & store availability warnings
      if (item.product.status !== ProductStatus.APPROVED) {
        warnings.push(`PRODUCT_UNAVAILABLE: O produto '${item.product.title}' não está disponível.`);
      }

      if (item.store.status !== StoreStatus.ACTIVE) {
        warnings.push(`STORE_UNAVAILABLE: A loja '${item.store.name}' está inativa.`);
      }

      const itemSubtotal = mulDecimal(currentPrice, item.quantity);
      totalSubtotal = addDecimal(totalSubtotal, itemSubtotal);

      if (!storesMap.has(item.storeId)) {
        storesMap.set(item.storeId, {
          store: {
            id: item.store.id,
            name: item.store.name,
            slug: item.store.slug,
            logoKey: item.store.logoKey,
          },
          items: [],
          subtotal: new Prisma.Decimal(0),
        });
      }

      const storeGroup = storesMap.get(item.storeId)!;
      storeGroup.items.push({
        id: item.id,
        productId: item.productId,
        productTitle: item.product.title,
        productSlug: item.product.slug,
        variantId: item.variantId,
        variantName: item.variant.name,
        sku: item.variant.sku,
        quantity: item.quantity,
        unitPrice: serializeDecimal(currentPrice),
        subtotal: serializeDecimal(itemSubtotal),
      });
      storeGroup.subtotal = addDecimal(storeGroup.subtotal, itemSubtotal);
    }

    const storesResponse = Array.from(storesMap.values()).map((group) => ({
      store: group.store,
      items: group.items,
      subtotal: serializeDecimal(group.subtotal),
    }));

    return {
      success: true,
      data: {
        id: cart.id,
        currency: cart.currency?.code || 'BRL',
        coupon: cart.coupon ? { id: cart.coupon.id, code: cart.coupon.code, type: cart.coupon.type, value: serializeDecimal(cart.coupon.value) } : null,
        stores: storesResponse,
        subtotal: serializeDecimal(totalSubtotal),
        estimatedDiscount: '0.00',
        estimatedShipping: '0.00',
        estimatedTax: '0.00',
        estimatedTotal: serializeDecimal(totalSubtotal),
        warnings,
      },
    };
  }
}
