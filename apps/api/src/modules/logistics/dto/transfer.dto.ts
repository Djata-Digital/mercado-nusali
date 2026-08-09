import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferItemDto {
  @ApiProperty({ example: 'variant-uuid-1', description: 'ID da variante' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 50, description: 'Quantidade a ser transferida' })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ example: 'source-location-id', description: 'Posição física de origem (opcional)' })
  @IsString()
  @IsOptional()
  sourceLocationId?: string;

  @ApiPropertyOptional({ example: 'target-location-id', description: 'Posição física de destino (opcional)' })
  @IsString()
  @IsOptional()
  targetLocationId?: string;
}

export class CreateTransferOrderDto {
  @ApiProperty({ example: 'origin-hub-id', description: 'ID do HUB de origem' })
  @IsString()
  @IsNotEmpty()
  originWarehouseId!: string;

  @ApiProperty({ example: 'destination-hub-id', description: 'ID do HUB de destino' })
  @IsString()
  @IsNotEmpty()
  destinationWarehouseId!: string;

  @ApiPropertyOptional({ example: 'Transferência para suprir demanda da campanha de Natal' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [CreateTransferItemDto], description: 'Itens da transferência' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransferItemDto)
  items!: CreateTransferItemDto[];
}
