import { ConflictException } from '@nestjs/common';
import { WarehouseStatus } from '@prisma/client';

import { CartStockService, CartStockStatus } from './cart-stock.service';

describe('CartStockService', () => {
  const service = new CartStockService();

  it('deve somar somente o estoque de armazéns ativos', () => {
    const result = service.evaluate({
      requestedQuantity: 4,
      inventoryItems: [
        {
          quantityAvailable: 5,
          reorderPoint: 1,
          warehouse: { status: WarehouseStatus.ACTIVE },
        },
        {
          quantityAvailable: 20,
          reorderPoint: 1,
          warehouse: { status: WarehouseStatus.MAINTENANCE },
        },
      ],
    });

    expect(result.availableQuantity).toBe(5);
    expect(result.activeWarehouseCount).toBe(1);
    expect(result.status).toBe(CartStockStatus.AVAILABLE);
    expect(result.isAvailable).toBe(true);
  });

  it('não deve subtrair quantityReserved novamente do saldo disponível', () => {
    const result = service.evaluate({
      requestedQuantity: 6,
      inventoryItems: [
        {
          quantityAvailable: 6,
          reorderPoint: 1,
          warehouse: { status: WarehouseStatus.ACTIVE },
          quantityReserved: 4,
        } as never,
      ],
    });

    expect(result.availableQuantity).toBe(6);
    expect(result.isAvailable).toBe(true);
  });

  it('deve marcar LOW_STOCK quando existe saldo, mas ele é insuficiente', () => {
    const result = service.evaluate({
      requestedQuantity: 8,
      inventoryItems: [
        {
          quantityAvailable: 5,
          reorderPoint: 1,
          warehouse: { status: WarehouseStatus.ACTIVE },
        },
      ],
    });

    expect(result.status).toBe(CartStockStatus.LOW_STOCK);
    expect(result.maximumAllowedQuantity).toBe(5);
    expect(result.isAvailable).toBe(false);
    expect(result.isLowStock).toBe(true);
  });

  it('deve marcar OUT_OF_STOCK quando o saldo ativo for zero', () => {
    const result = service.evaluate({
      requestedQuantity: 1,
      inventoryItems: [
        {
          quantityAvailable: 0,
          reorderPoint: 2,
          warehouse: { status: WarehouseStatus.ACTIVE },
        },
      ],
    });

    expect(result.status).toBe(CartStockStatus.OUT_OF_STOCK);
    expect(result.isAvailable).toBe(false);
  });

  it('deve marcar UNAVAILABLE quando não existir inventário comercial ativo', () => {
    const result = service.evaluate({
      requestedQuantity: 1,
      inventoryItems: [
        {
          quantityAvailable: 10,
          reorderPoint: 1,
          warehouse: { status: WarehouseStatus.CLOSED },
        },
      ],
    });

    expect(result.status).toBe(CartStockStatus.UNAVAILABLE);
    expect(result.availableQuantity).toBe(0);
    expect(result.isAvailable).toBe(false);
  });

  it('deve rejeitar quantidade maior que o máximo permitido', () => {
    const evaluation = service.evaluate({
      requestedQuantity: 4,
      inventoryItems: [
        {
          quantityAvailable: 3,
          warehouse: { status: WarehouseStatus.ACTIVE },
        },
      ],
    });

    expect(() => service.assertAvailable(4, evaluation)).toThrow(
      ConflictException,
    );
  });
});
