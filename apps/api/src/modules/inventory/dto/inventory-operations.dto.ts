import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class AdjustInventoryDto {
  @ApiProperty({ example: 'variant-uuid-1' })
  @IsNotEmpty()
  @IsString()
  variantId: string;

  @ApiProperty({ example: 'warehouse-uuid-1' })
  @IsNotEmpty()
  @IsString()
  warehouseId: string;

  @ApiProperty({ example: 100, description: 'Quantidade final desejada (Absoluto)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  newQuantity?: number;

  @ApiProperty({ example: 10, description: 'Delta de ajuste positivo ou negativo', required: false })
  @IsOptional()
  @IsNumber()
  quantityDelta?: number;

  @ApiProperty({ example: 50, description: 'Quantidade esperada antes da alteração para controle de concorrência', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedQuantityAvailable?: number;

  @ApiProperty({ example: 'Inventário físico inicial', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdjustInventoryByDeltaDto {
  @ApiProperty({ example: 'variant-uuid-1' })
  @IsNotEmpty()
  @IsString()
  variantId: string;

  @ApiProperty({ example: 'warehouse-uuid-1' })
  @IsNotEmpty()
  @IsString()
  warehouseId: string;

  @ApiProperty({ example: 15, description: 'Variação da quantidade (+15 para entrada, -10 para saída)' })
  @IsNotEmpty()
  @IsNumber()
  quantityDelta: number;

  @ApiProperty({ example: 'Entrada por contagem física', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetInventoryQuantityDto {
  @ApiProperty({ example: 'variant-uuid-1' })
  @IsNotEmpty()
  @IsString()
  variantId: string;

  @ApiProperty({ example: 'warehouse-uuid-1' })
  @IsNotEmpty()
  @IsString()
  warehouseId: string;

  @ApiProperty({ example: 50, description: 'Quantidade final desejada' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  targetQuantity: number;

  @ApiProperty({ example: 40, description: 'Quantidade lida antes do ajuste para controle de concorrência otimista' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  expectedQuantityAvailable: number;

  @ApiProperty({ example: 'Reajuste absoluto de balanço', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReserveInventoryDto {
  @ApiProperty({ example: 'inventory-item-uuid-1' })
  @IsNotEmpty()
  @IsString()
  inventoryItemId: string;

  @ApiProperty({ example: 5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'Reserva para pedido #1001', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReleaseInventoryDto {
  @ApiProperty({ example: 'inventory-item-uuid-1' })
  @IsNotEmpty()
  @IsString()
  inventoryItemId: string;

  @ApiProperty({ example: 5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'Cancelamento de pedido #1001', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TransferInventoryDto {
  @ApiProperty({ example: 'variant-uuid-1' })
  @IsNotEmpty()
  @IsString()
  variantId: string;

  @ApiProperty({ example: 'warehouse-origin-uuid' })
  @IsNotEmpty()
  @IsString()
  fromWarehouseId: string;

  @ApiProperty({ example: 'warehouse-destination-uuid' })
  @IsNotEmpty()
  @IsString()
  toWarehouseId: string;

  @ApiProperty({ example: 20 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 'Transferência para HUB Bissau', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
