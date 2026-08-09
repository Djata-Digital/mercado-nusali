import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WarehouseStatus } from '@prisma/client';

@Injectable()
export class InventoryAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Semântica única de estoque disponível (Requisito 1):
   * `quantityAvailable` na model InventoryItem representa diretamente o saldo comercial livre para venda.
   * Quando uma reserva de estoque é realizada, `quantityAvailable` é decrementado e `quantityReserved` é incrementado.
   * Portanto, a disponibilidade comercial total é o somatório direto de `quantityAvailable`
   * em armazéns ativos, sem subtrair `quantityReserved` novamente.
   */
  async getAvailableQuantity(variantId: string, destinationCountryId?: string): Promise<number> {
    const where: any = {
      variantId,
      warehouse: {
        status: WarehouseStatus.ACTIVE,
        deletedAt: null,
      },
    };

    if (destinationCountryId) {
      where.warehouse.countryId = destinationCountryId;
    }

    const items = await this.prisma.inventoryItem.findMany({
      where,
      select: { quantityAvailable: true },
    });

    const totalAvailable = items.reduce((acc, item) => acc + Math.max(0, item.quantityAvailable), 0);
    return totalAvailable;
  }
}
