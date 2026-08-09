import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingQuoteRequestDto } from './dto/shipping-quote.dto';
import { addDecimal, mulDecimal, serializeDecimal } from '../../common/utils/decimal.util';

@Injectable()
export class ShippingQuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateShippingQuotes(userId: string, dto: ShippingQuoteRequestDto) {
    const address = await this.prisma.address.findUnique({
      where: { id: dto.addressId },
      include: { country: true },
    });

    if (!address || address.deletedAt || !address.isActive || address.userId !== userId) {
      throw new NotFoundException('Endereço de entrega não encontrado.');
    }

    const activeCart = await this.prisma.cart.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: {
        currency: true,
        items: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    });

    if (!activeCart || activeCart.items.length === 0) {
      throw new BadRequestException('Carrinho vazio para calcular cotação de frete.');
    }

    let storesToCalculate = dto.stores;
    if (!storesToCalculate || storesToCalculate.length === 0) {
      const grouped = new Map<string, Array<{ variantId: string; quantity: number }>>();
      for (const item of activeCart.items) {
        if (!grouped.has(item.storeId)) grouped.set(item.storeId, []);
        grouped.get(item.storeId)!.push({
          variantId: item.variantId,
          quantity: item.quantity,
        });
      }
      storesToCalculate = Array.from(grouped.entries()).map(([storeId, items]) => ({
        storeId,
        items,
      }));
    }

    const quotesPerStore: any[] = [];

    for (const storeGroup of storesToCalculate) {
      const store = await this.prisma.store.findUnique({
        where: { id: storeGroup.storeId },
        include: { country: true },
      });
      if (!store) {
        throw new BadRequestException(`Loja ${storeGroup.storeId} não encontrada para cotação.`);
      }

      let totalWeightKg = new Prisma.Decimal(0);
      let physicalItems = 0;

      for (const item of storeGroup.items) {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true },
        });
        if (!variant || variant.product.storeId !== store.id) {
          throw new BadRequestException('Item inválido para a loja informada na cotação.');
        }

        if (variant.product.productType === ProductType.PHYSICAL) {
          physicalItems += 1;
          const unitWeight = variant.weight ?? variant.product.weight;
          if (!unitWeight || new Prisma.Decimal(unitWeight).lte(0)) {
            throw new BadRequestException(
              `Produto "${variant.product.title}" não possui peso válido para cotação real de frete.`,
            );
          }
          totalWeightKg = addDecimal(totalWeightKg, mulDecimal(unitWeight, item.quantity));
        }
      }

      if (physicalItems === 0) {
        quotesPerStore.push({
          storeId: store.id,
          storeName: store.name,
          options: [{
            serviceCode: 'DIGITAL_DELIVERY',
            name: 'Entrega Digital',
            amount: '0.00',
            currency: activeCart.currency.code,
            estimatedMinDays: 0,
            estimatedMaxDays: 0,
            provider: 'DIGITAL_DELIVERY',
          }],
        });
        continue;
      }

      const rules = await this.prisma.shippingRateRule.findMany({
        where: {
          originCountryId: store.countryId,
          destinationCountryId: address.countryId,
          currencyId: activeCart.currencyId,
          isActive: true,
          OR: [{ storeId: store.id }, { storeId: null }],
        },
        include: { currency: true },
        orderBy: [{ storeId: 'desc' }, { serviceCode: 'asc' }],
      });

      const storeSpecificRules = rules.filter((rule) => rule.storeId === store.id);
      const applicableRules = storeSpecificRules.length
        ? storeSpecificRules
        : rules.filter((rule) => rule.storeId === null);

      if (!applicableRules.length) {
        throw new BadRequestException(
          `Nenhuma tarifa de frete ativa foi configurada para ${store.country.code} → ${address.country.code} na moeda ${activeCart.currency.code}.`,
        );
      }

      quotesPerStore.push({
        storeId: store.id,
        storeName: store.name,
        options: applicableRules.map((rule) => ({
          serviceCode: rule.serviceCode,
          name: rule.name,
          amount: serializeDecimal(
            addDecimal(rule.baseAmount, mulDecimal(rule.amountPerKg, totalWeightKg)),
          ),
          currency: rule.currency.code,
          estimatedMinDays: rule.estimatedMinDays,
          estimatedMaxDays: rule.estimatedMaxDays,
          provider: 'DB_RULE',
        })),
      });
    }

    return {
      addressId: address.id,
      destinationCountry: address.country.code,
      currency: activeCart.currency.code,
      stores: quotesPerStore,
    };
  }
}
