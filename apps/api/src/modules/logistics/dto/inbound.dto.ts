import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ReceivingInspectionStatus } from '@prisma/client';

export class CreateInboundItemDto {
  @ApiProperty({ example: 'variant-uuid-1', description: 'ID da variante do produto' })
  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 100, description: 'Quantidade esperada na carga' })
  @IsInt()
  @Min(1)
  expectedQuantity!: number;

  @ApiPropertyOptional({ example: 0.5, description: 'Peso unitário em KG' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitWeight?: number;

  @ApiPropertyOptional({ example: 0.01, description: 'Volume unitário em m³' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitVolume?: number;
}

export class CreateInboundShipmentDto {
  @ApiProperty({ example: 'warehouse-hub-id', description: 'ID do HUB de destino' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({ example: 'Fornecedor Agro Guiné Ltda', description: 'Nome do fornecedor' })
  @IsString()
  @IsNotEmpty()
  supplierName!: string;

  @ApiPropertyOptional({ example: 'SUP-001', description: 'Código do fornecedor' })
  @IsString()
  @IsOptional()
  supplierCode?: string;

  @ApiPropertyOptional({ example: 'Transportes TransSaara', description: 'Nome da transportadora de entrega' })
  @IsString()
  @IsOptional()
  carrierName?: string;

  @ApiPropertyOptional({ example: 'TRK-987654', description: 'Código de rastreamento do envio' })
  @IsString()
  @IsOptional()
  trackingCode?: string;

  @ApiPropertyOptional({ example: '2026-08-10T10:00:00.000Z', description: 'Data/hora estimada de chegada' })
  @IsOptional()
  estimatedArrival?: string;

  @ApiProperty({ type: [CreateInboundItemDto], description: 'Itens esperados no recebimento' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInboundItemDto)
  items!: CreateInboundItemDto[];
}

export class InspectInboundItemDto {
  @ApiProperty({ example: 'item-uuid-1', description: 'ID do InboundItem' })
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @ApiProperty({ example: 100, description: 'Quantidade inspecionada' })
  @IsInt()
  @Min(0)
  inspectedQuantity!: number;

  @ApiProperty({ example: 98, description: 'Quantidade aprovada na inspeção' })
  @IsInt()
  @Min(0)
  passedQuantity!: number;

  @ApiPropertyOptional({ example: 2, description: 'Quantidade reprovada/avariada' })
  @IsInt()
  @Min(0)
  @IsOptional()
  failedQuantity?: number;

  @ApiPropertyOptional({ enum: ReceivingInspectionStatus, example: ReceivingInspectionStatus.APPROVED })
  @IsEnum(ReceivingInspectionStatus)
  @IsOptional()
  status?: ReceivingInspectionStatus;

  @ApiPropertyOptional({ example: 49.5, description: 'Peso total registrado no recebimento' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  weightRecorded?: number;

  @ApiPropertyOptional({ example: ['photo_url_1.png'], description: 'Fotos da inspeção' })
  @IsArray()
  @IsOptional()
  photos?: string[];

  @ApiPropertyOptional({ example: '2 caixas com lacre violado' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: 'Avaria durante transporte' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
