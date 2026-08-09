import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateShippingManifestDto {
  @ApiProperty({ example: 'warehouse-hub-id', description: 'ID do HUB de expedição' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ example: ['shipment-uuid-1', 'shipment-uuid-2'], description: 'IDs das expedições a incluir no romaneio' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  shipmentIds!: string[];

  @ApiPropertyOptional({ example: 'João da Silva', description: 'Nome do motorista do veículo de transporte' })
  @IsString()
  @IsOptional()
  driverName?: string;

  @ApiPropertyOptional({ example: 'BI-123456', description: 'Documento do motorista' })
  @IsString()
  @IsOptional()
  driverDocument?: string;

  @ApiPropertyOptional({ example: 'ABC-9876', description: 'Placa do veículo' })
  @IsString()
  @IsOptional()
  vehiclePlate?: string;

  @ApiPropertyOptional({ example: 'Transportes TransSaara', description: 'Nome da transportadora' })
  @IsString()
  @IsOptional()
  carrierName?: string;

  @ApiPropertyOptional({ example: 'Carga completa direcionada para a região de Bafatá' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CloseManifestDto {
  @ApiPropertyOptional({ example: 'Romaneio lacrado e pronto para saída do veículo' })
  @IsString()
  @IsOptional()
  notes?: string;
}
