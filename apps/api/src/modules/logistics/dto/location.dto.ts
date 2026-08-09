import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, IsNumber } from 'class-validator';
import { HubLocationStatus } from '@prisma/client';

export class CreateLocationDto {
  @ApiProperty({ example: 'warehouse-hub-id', description: 'ID do HUB' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ example: 'zone-storage-id', description: 'ID da Zona Logística' })
  @IsString()
  @IsNotEmpty()
  zoneId!: string;

  @ApiPropertyOptional({ example: 'shelf-id', description: 'ID da Prateleira (opcional)' })
  @IsString()
  @IsOptional()
  shelfId?: string;

  @ApiProperty({ example: 'HUB-GW-01-STO-A01-R01-S01-B01', description: 'Código único da posição/bin' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ enum: HubLocationStatus, example: HubLocationStatus.AVAILABLE })
  @IsEnum(HubLocationStatus)
  @IsOptional()
  status?: HubLocationStatus;

  @ApiPropertyOptional({ example: 100, description: 'Capacidade máxima de unidades' })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: 500, description: 'Peso máximo em KG' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxWeight?: number;

  @ApiPropertyOptional({ example: 2.5, description: 'Volume máximo em m³' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxVolume?: number;
}
