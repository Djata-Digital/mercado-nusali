import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, IsNumber, IsArray } from 'class-validator';
import { HubZoneType, HubLocationStatus, WarehouseStatus } from '@prisma/client';

export class CreateHubDto {
  @ApiProperty({ example: 'HUB-GW-01', description: 'Código único do HUB' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'HUB Central Bissau', description: 'Nome do HUB logístico' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'country-gw-id', description: 'ID do país de localização' })
  @IsString()
  @IsNotEmpty()
  countryId!: string;

  @ApiPropertyOptional({ example: 'Bissau', description: 'Cidade' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Av. Amílcar Cabral', description: 'Endereço linha 1' })
  @IsString()
  @IsOptional()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Africa/Bissau', description: 'Timezone do HUB' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ example: 'curr-xof-id', description: 'ID da moeda principal do HUB' })
  @IsString()
  @IsOptional()
  primaryCurrencyId?: string;

  @ApiPropertyOptional({ example: ['pt', 'fr'], description: 'Idiomas operacionais' })
  @IsArray()
  @IsOptional()
  languages?: string[];

  @ApiPropertyOptional({ example: 50000, description: 'Capacidade máxima de posições/itens' })
  @IsInt()
  @Min(0)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: 100000, description: 'Capacidade máxima de peso em KG' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxWeight?: number;

  @ApiPropertyOptional({ example: 5000, description: 'Capacidade máxima de volume em m³' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxVolume?: number;

  @ApiPropertyOptional({ example: 'user-manager-id', description: 'ID do gerente responsável' })
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional({ description: 'Horário de funcionamento em JSON' })
  @IsOptional()
  operatingHours?: any;
}

export class UpdateHubDto {
  @ApiPropertyOptional({ example: 'HUB Central Bissau II' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: WarehouseStatus, example: WarehouseStatus.ACTIVE })
  @IsEnum(WarehouseStatus)
  @IsOptional()
  status?: WarehouseStatus;

  @ApiPropertyOptional({ example: 60000 })
  @IsInt()
  @Min(0)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: 120000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxWeight?: number;

  @ApiPropertyOptional({ example: 6000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxVolume?: number;

  @ApiPropertyOptional({ example: 'user-new-manager-id' })
  @IsString()
  @IsOptional()
  managerId?: string;
}
