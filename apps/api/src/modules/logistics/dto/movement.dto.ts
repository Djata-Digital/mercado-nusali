import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateWarehouseMovementDto {
  @ApiProperty({ example: 'warehouse-hub-id', description: 'ID do HUB' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ example: 'variant-uuid-1', description: 'ID da variante' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiPropertyOptional({ example: 'location-source-id', description: 'Posição de origem' })
  @IsString()
  @IsOptional()
  sourceLocationId?: string;

  @ApiPropertyOptional({ example: 'location-dest-id', description: 'Posição de destino' })
  @IsString()
  @IsOptional()
  destinationLocationId?: string;

  @ApiProperty({ example: 10, description: 'Quantidade movimentada' })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ example: 'Reorganização do corredor de armazenagem' })
  @IsString()
  @IsOptional()
  reason?: string;
}
