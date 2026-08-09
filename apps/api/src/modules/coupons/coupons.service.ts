import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';
import { serializeDecimal, percentDecimal } from '../../common/utils/decimal.util';
import { Prisma, CouponStatus, CouponType } from '@prisma/client';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createCoupon(userId: string, dto: CreateCouponDto, reqInfo: any) {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestException('Já existe um cupom cadastrado com este código.');
    }

    if (dto.type === CouponType.PERCENTAGE && (dto.value <= 0 || dto.value > 100)) {
      throw new BadRequestException('Percentual de desconto deve estar entre 0.01% e 100%.');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        currencyId: dto.currencyId,
        scope: dto.scope || 'PLATFORM',
        sellerId: dto.sellerId,
        storeId: dto.storeId,
        startsAt: new Date(dto.startsAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        minimumOrderAmount: dto.minimumOrderAmount ? new Prisma.Decimal(dto.minimumOrderAmount) : null,
        maximumDiscountAmount: dto.maximumDiscountAmount ? new Prisma.Decimal(dto.maximumDiscountAmount) : null,
        totalUsageLimit: dto.totalUsageLimit,
        usageLimitPerUser: dto.usageLimitPerUser,
        status: dto.status || CouponStatus.ACTIVE,
        createdById: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'COUPON_CREATED',
      entity: 'Coupon',
      entityId: coupon.id,
      newValue: { code, type: coupon.type, value: dto.value },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return coupon;
  }

  async validateCoupon(userId: string, dto: ValidateCouponDto) {
    const code = dto.code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({
      where: { code },
      include: { rules: true },
    });

    if (!coupon || coupon.deletedAt || coupon.status !== CouponStatus.ACTIVE) {
      throw new BadRequestException('Cupom inválido ou inativo.');
    }

    const now = new Date();
    if (coupon.startsAt > now) {
      throw new BadRequestException('Cupom ainda não está disponível para uso.');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Cupom expirado.');
    }

    if (coupon.totalUsageLimit && coupon.currentUsageCount >= coupon.totalUsageLimit) {
      throw new BadRequestException('Limite global de uso deste cupom foi atingido.');
    }

    if (coupon.usageLimitPerUser) {
      const userRedemptionsCount = await this.prisma.couponRedemption.count({
        where: { couponId: coupon.id, userId, status: 'ACTIVE' },
      });
      if (userRedemptionsCount >= coupon.usageLimitPerUser) {
        throw new BadRequestException('Você atingiu o limite individual de uso deste cupom.');
      }
    }

    if (coupon.currencyId && coupon.currencyId !== dto.currencyId) {
      throw new BadRequestException('Cupom incompatível com a moeda do pedido.');
    }

    // Requirement 6: Regra de Primeira Compra (firstPurchaseOnly)
    if (coupon.rules && coupon.rules.some((r) => r.firstPurchaseOnly === true)) {
      const completedOrders = await this.prisma.order.count({
        where: { userId, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
      });
      if (completedOrders > 0) {
        throw new BadRequestException('Este cupom é exclusivo para a primeira compra.');
      }
    }

    const subtotalDec = new Prisma.Decimal(dto.subtotal);

    if (coupon.minimumOrderAmount && subtotalDec.lt(coupon.minimumOrderAmount)) {
      throw new BadRequestException(
        `O subtotal mínimo para utilizar este cupom é de ${serializeDecimal(coupon.minimumOrderAmount)}.`,
      );
    }

    let calculatedDiscount = new Prisma.Decimal(0);

    if (coupon.type === CouponType.PERCENTAGE) {
      calculatedDiscount = percentDecimal(subtotalDec, coupon.value);
    } else if (coupon.type === CouponType.FIXED_AMOUNT) {
      calculatedDiscount = coupon.value.gt(subtotalDec) ? subtotalDec : coupon.value;
    } else if (coupon.type === CouponType.FREE_SHIPPING) {
      // Requirement 7: FRETE GRÁTIS
      calculatedDiscount = new Prisma.Decimal(0); // Aplicado sobre o frete na cotação/confirm
    }

    if (coupon.maximumDiscountAmount && calculatedDiscount.gt(coupon.maximumDiscountAmount)) {
      calculatedDiscount = coupon.maximumDiscountAmount;
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: serializeDecimal(coupon.value),
        calculatedDiscount: serializeDecimal(calculatedDiscount),
      },
    };
  }

  async listCoupons(query: any) {
    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.storeId) where.storeId = query.storeId;
    if (query.sellerId) where.sellerId = query.sellerId;

    return this.prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCouponById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { rules: true },
    });
    if (!coupon || coupon.deletedAt) {
      throw new NotFoundException('Cupom não encontrado.');
    }
    return coupon;
  }

  async updateCoupon(userId: string, id: string, dto: UpdateCouponDto, reqInfo: any) {
    const coupon = await this.getCouponById(id);

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        totalUsageLimit: dto.totalUsageLimit,
        usageLimitPerUser: dto.usageLimitPerUser,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.auditService.log({
      userId,
      action: 'COUPON_UPDATED',
      entity: 'Coupon',
      entityId: id,
      newValue: dto,
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return updated;
  }
}
