import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CouponStatus } from '@prisma/client';

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida um cupom para um usuário e um valor de pedido.
   */
  async validateCoupon(code: string, userId: string, subtotal: number, storeIds: string[] = [], productIds: string[] = [], categoryIds: string[] = []) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
      include: { rules: true },
    });

    if (!coupon || coupon.status !== CouponStatus.ACTIVE || (coupon as any).deletedAt) {
      throw new NotFoundException(`Cupom '${code}' não encontrado ou inativo.`);
    }

    const now = new Date();
    if (coupon.startsAt > now) {
      throw new BadRequestException('Este cupom ainda não está ativo.');
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Este cupom está expirado.');
    }

    if (coupon.minimumOrderAmount && subtotal < Number(coupon.minimumOrderAmount)) {
      throw new BadRequestException(
        `Valor mínimo de pedido para este cupom é R$ ${Number(coupon.minimumOrderAmount).toFixed(2)}.`,
      );
    }

    if (coupon.totalUsageLimit && coupon.currentUsageCount >= coupon.totalUsageLimit) {
      throw new BadRequestException('Este cupom atingiu o limite máximo de utilizações.');
    }

    if (coupon.usageLimitPerUser) {
      const userUsageCount = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId, status: 'ACTIVE' },
      });
      if (userUsageCount >= coupon.usageLimitPerUser) {
        throw new BadRequestException('Você atingiu o limite máximo de utilização deste cupom.');
      }
    }

    if (coupon.storeId && !storeIds.includes(coupon.storeId)) {
      throw new BadRequestException('Este cupom não é válido para as lojas selecionadas.');
    }

    if (coupon.sellerId) {
      const storesOfSeller = await this.prisma.store.findMany({
        where: { sellerId: coupon.sellerId },
        select: { id: true },
      });
      const validStoreIds = storesOfSeller.map((s) => s.id);
      const isEligible = storeIds.some((id) => validStoreIds.includes(id));
      if (!isEligible) {
        throw new BadRequestException('Este cupom não é elegível para este vendedor.');
      }
    }

    // Regras de produto/categoria se houver
    if (coupon.rules && coupon.rules.length > 0) {
      const allowedProducts = coupon.rules.map((r) => r.productId).filter(Boolean);
      const allowedCategories = coupon.rules.map((r) => r.categoryId).filter(Boolean);

      if (allowedProducts.length > 0) {
        const matchesProduct = productIds.some((pid) => allowedProducts.includes(pid));
        if (!matchesProduct) {
          throw new BadRequestException('Este cupom não se aplica a nenhum produto do seu carrinho.');
        }
      }

      if (allowedCategories.length > 0) {
        const matchesCategory = categoryIds.some((cid) => allowedCategories.includes(cid));
        if (!matchesCategory) {
          throw new BadRequestException('Este cupom não se aplica a nenhuma categoria do seu carrinho.');
        }
      }
    }

    // Cálculo do valor do desconto
    let discountAmount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discountAmount = (subtotal * Number(coupon.value)) / 100;
      if (coupon.maximumDiscountAmount && discountAmount > Number(coupon.maximumDiscountAmount)) {
        discountAmount = Number(coupon.maximumDiscountAmount);
      }
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discountAmount = Math.min(Number(coupon.value), subtotal);
    } else if (coupon.type === 'FREE_SHIPPING') {
      discountAmount = 0; // Desconto aplicado no frete
    }

    return {
      coupon,
      discountAmount: Number(discountAmount.toFixed(2)),
      isFreeShipping: coupon.type === 'FREE_SHIPPING',
    };
  }
}
