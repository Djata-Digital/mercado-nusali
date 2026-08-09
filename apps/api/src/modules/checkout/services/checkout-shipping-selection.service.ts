import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ShippingOption } from '../shipping/shipping-calculation.service';

export interface CheckoutShippingSelectionInput {
  storeId: string;
  serviceCode: string;
}

export interface ResolvedCheckoutShippingSelection {
  storeId: string;
  providerCode: string;
  serviceCode: string;
  serviceName: string;
  cost: Prisma.Decimal;
  estimatedMinDays: number;
  estimatedMaxDays: number;
}

/**
 * CheckoutShippingSelectionService
 *
 * Resolve as escolhas de frete exclusivamente a partir das cotações imutáveis
 * persistidas na CheckoutSession.
 *
 * Regras:
 * - nunca confia em custo enviado pelo frontend;
 * - exige uma opção válida para cada loja;
 * - permite seleção automática somente quando existe uma única opção;
 * - normaliza tanto o formato array quanto o formato Record legado.
 */
@Injectable()
export class CheckoutShippingSelectionService {
  resolve(input: {
    storeIds: string[];
    shippingQuotesJson: Prisma.JsonValue;
    selections?:
      | CheckoutShippingSelectionInput[]
      | Record<string, { serviceCode: string }>;
  }): ResolvedCheckoutShippingSelection[] {
    const quotesByStore = this.parseQuotes(input.shippingQuotesJson);
    const requested = this.normalizeSelections(input.selections);

    return input.storeIds.map((storeId) => {
      const options = quotesByStore[storeId] ?? [];
      if (options.length === 0) {
        throw new BadRequestException({
          statusCode: 400,
          message: `Nenhuma cotação de frete está disponível para a loja ${storeId}.`,
          errorCode: 'CHECKOUT_SHIPPING_QUOTE_NOT_FOUND',
        });
      }

      const selectedCode = requested.get(storeId);
      const selected = selectedCode
        ? options.find((option) => option.serviceCode === selectedCode)
        : options.length === 1
          ? options[0]
          : undefined;

      if (!selected) {
        throw new BadRequestException({
          statusCode: 400,
          message: `Selecione uma opção de frete válida para a loja ${storeId}.`,
          errorCode: 'CHECKOUT_SHIPPING_SELECTION_REQUIRED',
        });
      }

      return {
        storeId,
        providerCode: selected.providerCode,
        serviceCode: selected.serviceCode,
        serviceName: selected.serviceName,
        cost: new Prisma.Decimal(selected.cost),
        estimatedMinDays: selected.estimatedMinDays,
        estimatedMaxDays: selected.estimatedMaxDays,
      };
    });
  }

  private normalizeSelections(
    selections?:
      | CheckoutShippingSelectionInput[]
      | Record<string, { serviceCode: string }>,
  ): Map<string, string> {
    const normalized = new Map<string, string>();

    if (!selections) return normalized;

    if (Array.isArray(selections)) {
      for (const selection of selections) {
        normalized.set(selection.storeId, selection.serviceCode);
      }
      return normalized;
    }

    for (const [storeId, selection] of Object.entries(selections)) {
      normalized.set(storeId, selection.serviceCode);
    }

    return normalized;
  }

  private parseQuotes(
    value: Prisma.JsonValue,
  ): Record<string, ShippingOption[]> {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {};
    }

    return value as unknown as Record<string, ShippingOption[]>;
  }
}
