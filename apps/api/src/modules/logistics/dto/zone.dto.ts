import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { HubZoneType } from '@prisma/client';

export class CreateZoneDto {
  @ApiProperty({ example: 'warehouse-hub-id', description: 'ID do HUB/Warehouse' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ example: 'Z-RECEIVING', description: 'Código único da zona no HUB' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Zona de Recebimento e Triagem', description: 'Nome da zona' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: HubZoneType, example: HubZoneType.RECEIVING, description: 'Tipo funcional da zona' })
  @IsEnum(HubZoneType)
  @IsNotEmpty()
  type!: HubZoneType;

  @ApiPropertyOptional({ example: 10000, description: 'Capacidade máxima de posições/itens da zona' })
  @IsInt()
  @Min(0)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: 1, description: 'Prioridade de alocação de estoque' })
  @IsInt()
  @Min(1)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ example: 'Perto da Doca 01', description: 'Observações de localização' })
  @IsString()
  @IsOptional()
  locationNotes?: string;
}

export class CreateStructureDto {
  @ApiProperty({ example: 'Aisle A', description: 'Nome do Corredor/Estante/Prateleira' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'A01', description: 'Código do Corredor/Estante/Prateleira' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
