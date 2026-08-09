import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ShippingCalculationRequest {
  originCountryId: string;
  destinationCountryId: string;
  postalCode?: string;
  storeId: string;
  warehouseId?: string;
  totalWeightKg: number;
  totalVolumeM3: number;
  subtotal: number;
  currencyId: string;
}

export interface ShippingOption {
  providerCode: string;
  serviceCode: string;
  serviceName: string;
  carrierId?: string;
  cost: string | number;
  estimatedMinDays: number;
  estimatedMaxDays: number;
  status: 'CALCULATED' | 'ESTIMATED' | 'FALLBACK';
}

export interface IShippingCalculationProvider {
  providerCode: string;
  calculateShipping(request: ShippingCalculationRequest): Promise<ShippingOption[]>;
}

/**
 * Mantidos apenas por compatibilidade de DI com CheckoutModule.
 * Não geram tarifas comerciais.
 */
@Injectable()
export class InternalShippingProvider implements IShippingCalculationProvider {
  readonly providerCode = 'INTERNAL_SHIPPING_DISABLED';
  async calculateShipping(): Promise<ShippingOption[]> {
    return [];
  }
}

@Injectable()
export class GenericLocalShippingProvider implements IShippingCalculationProvider {
  readonly providerCode = 'GENERIC_LOCAL_SHIPPING_DISABLED';
  async calculateShipping(): Promise<ShippingOption[]> {
    return [];
  }
}

/**
 * Fonte comercial canônica do checkout.
 *
 * Regras:
 * - somente ShippingRateRule ativa no PostgreSQL;
 * - moeda obrigatoriamente igual à moeda do carrinho;
 * - regra específica da loja prevalece sobre regra global;
 * - cálculo monetário com Prisma.Decimal;
 * - sem provider simulado;
 * - sem frete fixo/fallback silencioso.
 */
@Injectable()
export class ShippingCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    _internalProvider: InternalShippingProvider,
    _genericProvider: GenericLocalShippingProvider,
  ) {}

  async calculateShippingOptions(request: ShippingCalculationRequest): Promise<ShippingOption[]> {
    const rules = await this.prisma.shippingRateRule.findMany({
      where: {
        originCountryId: request.originCountryId,
        destinationCountryId: request.destinationCountryId,
        currencyId: request.currencyId,
        isActive: true,
        OR: [{ storeId: request.storeId }, { storeId: null }],
      },
      orderBy: [{ storeId: 'desc' }, { serviceCode: 'asc' }],
    });

    const storeSpecific = rules.filter((rule) => rule.storeId === request.storeId);
    const applicable = storeSpecific.length
      ? storeSpecific
      : rules.filter((rule) => rule.storeId === null);

    if (!applicable.length) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Nenhuma tarifa de frete real está configurada para esta rota, loja e moeda.',
        errorCode: 'CHECKOUT_SHIPPING_RATE_NOT_CONFIGURED',
      });
    }

    const weight = new Prisma.Decimal(String(request.totalWeightKg || 0));

    return applicable.map((rule) => {
      const cost = new Prisma.Decimal(rule.baseAmount).plus(
        new Prisma.Decimal(rule.amountPerKg).mul(weight),
      );

      return {
        providerCode: 'DB_RULE',
        serviceCode: rule.serviceCode,
        serviceName: rule.name,
        cost: cost.toFixed(2),
        estimatedMinDays: rule.estimatedMinDays,
        estimatedMaxDays: rule.estimatedMaxDays,
        status: 'CALCULATED' as const,
      };
    });
  }
}
