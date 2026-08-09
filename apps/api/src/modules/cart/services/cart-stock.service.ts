import { ConflictException, Injectable } from '@nestjs/common';
import { WarehouseStatus } from '@prisma/client';

/**
 * Estado comercial calculado para o estoque de um item do carrinho.
 *
 * O status representa a disponibilidade atual e nunca substitui a reserva
 * transacional realizada durante o checkout.
 */
export enum CartStockStatus {
  AVAILABLE = 'AVAILABLE',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  UNAVAILABLE = 'UNAVAILABLE',
}

/**
 * Estrutura mínima de inventário necessária para calcular disponibilidade.
 *
 * `quantityAvailable` já representa o saldo comercial livre no modelo atual
 * do Mercado Nusali. Portanto, `quantityReserved` não é subtraído novamente.
 */
export interface CartInventoryItemReference {
  quantityAvailable: number;
  reorderPoint?: number | null;
  warehouse?: {
    status: WarehouseStatus;
  } | null;
}

export interface CartStockEvaluationInput {
  inventoryItems: CartInventoryItemReference[];
  requestedQuantity: number;
}

export interface CartStockEvaluation {
  status: CartStockStatus;
  requestedQuantity: number;
  availableQuantity: number;
  maximumAllowedQuantity: number;
  remainingAfterRequest: number;
  activeWarehouseCount: number;
  isAvailable: boolean;
  isLowStock: boolean;
}

/**
 * CartStockService
 *
 * Centraliza a leitura e interpretação do estoque comercial usado pelo
 * carrinho e pelo checkout.
 *
 * Regras importantes:
 * - considera somente armazéns ativos;
 * - nunca soma saldos negativos;
 * - não subtrai `quantityReserved` duas vezes;
 * - não cria reservas;
 * - não altera inventário;
 * - deve ser revalidado pelo checkout dentro da transação de reserva.
 */
@Injectable()
export class CartStockService {
  /**
   * Calcula a disponibilidade comercial atual para uma quantidade solicitada.
   */
  evaluate(input: CartStockEvaluationInput): CartStockEvaluation {
    const activeInventoryItems = input.inventoryItems.filter((inventoryItem) =>
      this.isInventoryItemCommerciallyActive(inventoryItem),
    );

    const availableQuantity = activeInventoryItems.reduce(
      (total, inventoryItem) =>
        total + Math.max(0, inventoryItem.quantityAvailable),
      0,
    );

    const reorderPoint = activeInventoryItems.reduce(
      (highest, inventoryItem) =>
        Math.max(highest, Math.max(0, inventoryItem.reorderPoint ?? 0)),
      0,
    );

    const status = this.resolveStatus({
      activeInventoryCount: activeInventoryItems.length,
      availableQuantity,
      requestedQuantity: input.requestedQuantity,
      reorderPoint,
    });

    const isAvailable =
      input.requestedQuantity > 0 &&
      availableQuantity >= input.requestedQuantity &&
      status !== CartStockStatus.UNAVAILABLE &&
      status !== CartStockStatus.OUT_OF_STOCK;

    return {
      status,
      requestedQuantity: input.requestedQuantity,
      availableQuantity,
      maximumAllowedQuantity: availableQuantity,
      remainingAfterRequest: Math.max(
        0,
        availableQuantity - Math.max(0, input.requestedQuantity),
      ),
      activeWarehouseCount: activeInventoryItems.length,
      isAvailable,
      isLowStock: status === CartStockStatus.LOW_STOCK,
    };
  }

  /**
   * Retorna apenas a quantidade comercial disponível.
   */
  calculateAvailableQuantity(
    inventoryItems: CartInventoryItemReference[],
  ): number {
    return this.evaluate({
      inventoryItems,
      requestedQuantity: 1,
    }).availableQuantity;
  }

  /**
   * Garante que a quantidade solicitada pode ser atendida neste momento.
   */
  assertAvailable(
    requestedQuantity: number,
    evaluation: CartStockEvaluation,
  ): void {
    if (requestedQuantity > evaluation.availableQuantity) {
      throw new ConflictException(
        `Estoque insuficiente. Solicitado: ${requestedQuantity}, Disponível: ${evaluation.availableQuantity}.`,
      );
    }
  }

  private isInventoryItemCommerciallyActive(
    inventoryItem: CartInventoryItemReference,
  ): boolean {
    // Mantém compatibilidade com registros/testes antigos sem relação carregada.
    // Quando o warehouse é carregado, somente ACTIVE participa do cálculo.
    return (
      !inventoryItem.warehouse ||
      inventoryItem.warehouse.status === WarehouseStatus.ACTIVE
    );
  }

  private resolveStatus(input: {
    activeInventoryCount: number;
    availableQuantity: number;
    requestedQuantity: number;
    reorderPoint: number;
  }): CartStockStatus {
    if (input.activeInventoryCount === 0) {
      return CartStockStatus.UNAVAILABLE;
    }

    if (input.availableQuantity <= 0) {
      return CartStockStatus.OUT_OF_STOCK;
    }

    if (
      input.requestedQuantity > input.availableQuantity ||
      input.availableQuantity <= input.reorderPoint
    ) {
      return CartStockStatus.LOW_STOCK;
    }

    return CartStockStatus.AVAILABLE;
  }
}
