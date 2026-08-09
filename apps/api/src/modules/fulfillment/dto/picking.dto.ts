import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PickingBatchType, PickingOrderStatus } from '@prisma/client';

export class CreatePickingOrderDto {
  @ApiProperty({ example: 'order-uuid-1', description: 'ID do pedido aprovado' })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ example: 'warehouse-hub-id', description: 'ID do HUB de origem' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiPropertyOptional({ example: 'Separar com prioridade expressa' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreatePickingBatchDto {
  @ApiProperty({ example: 'warehouse-hub-id', description: 'ID do HUB de origem' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ enum: PickingBatchType, example: PickingBatchType.BATCH, description: 'Estratégia de separação (SINGLE_ORDER, BATCH, WAVE)' })
  @IsEnum(PickingBatchType)
  @IsNotEmpty()
  type!: PickingBatchType;

  @ApiProperty({ example: ['picking-order-1', 'picking-order-2'], description: 'IDs das Picking Orders a agrupar' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  pickingOrderIds!: string[];

  @ApiPropertyOptional({ example: 'operator-user-id', description: 'ID do operador responsável pelo lote' })
  @IsString()
  @IsOptional()
  assignedOperatorId?: string;
}

export class PickItemDto {
  @ApiProperty({ example: 'picking-item-id', description: 'ID do PickingItem' })
  @IsString()
  @IsNotEmpty()
  pickingItemId!: string;

  @ApiProperty({ example: 5, description: 'Quantidade efetivamente separada' })
  @IsInt()
  @Min(0)
  pickedQuantity!: number;

  @ApiPropertyOptional({ example: 'HUB-GW-01-STO-A01-R01-S01-B01', description: 'Código do bin de onde retirou' })
  @IsString()
  @IsOptional()
  locationCode?: string;

  @ApiPropertyOptional({ example: 'Item avariado no fundo da prateleira' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CompletePickingOrderDto {
  @ApiProperty({ type: [PickItemDto], description: 'Itens separados pelo operador' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickItemDto)
  items!: PickItemDto[];
}

export class CancelPickingOrderDto {
  @ApiProperty({ example: 'Produto fora de estoque ou avariado', description: 'Motivo do cancelamento' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
