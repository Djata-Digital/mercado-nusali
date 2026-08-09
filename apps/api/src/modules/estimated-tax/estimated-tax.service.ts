import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { percentDecimal } from '../../common/utils/decimal.util';

@Injectable()
export class EstimatedTaxService {
  /**
   * Requirement 5: Calcula o imposto estimado (não fiscal) baseado na origem do armazém e país de destino.
   */
  calculateItemEstimatedTax(
    itemSubtotal: Prisma.Decimal,
    originCountryId: string | null | undefined,
    destinationCountryId: string,
  ): Prisma.Decimal {
    if (!originCountryId || originCountryId === destinationCountryId) {
      return new Prisma.Decimal(0);
    }
    // 5% de taxa estimada para transporte e desembaraço internacional
    return percentDecimal(itemSubtotal, 5);
  }

  calculateEstimatedTax(
    subtotal: Prisma.Decimal,
    isInternational = false,
  ): Prisma.Decimal {
    if (!isInternational) {
      return new Prisma.Decimal(0);
    }
    return percentDecimal(subtotal, 5);
  }
}
