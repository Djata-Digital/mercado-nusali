import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, IsNumber } from 'class-validator';
import { PackingMaterialType, PackingMaterialStatus } from '@prisma/client';

export class CreatePackingMaterialDto {
  @ApiProperty({ example: 'BOX-M-01', description: 'Código único da embalagem' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Caixa de Papelão Média', description: 'Nome da embalagem' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: PackingMaterialType, example: PackingMaterialType.BOX, description: 'Tipo da embalagem' })
  @IsEnum(PackingMaterialType)
  @IsNotEmpty()
  type!: PackingMaterialType;

  @ApiProperty({ example: 0.25, description: 'Peso próprio da embalagem em KG' })
  @IsNumber()
  @Min(0)
  ownWeight!: number;

  @ApiProperty({ example: 15.0, description: 'Capacidade máxima de peso suportado em KG' })
  @IsNumber()
  @Min(0)
  maxWeight!: number;

  @ApiProperty({ example: 30.0, description: 'Largura em cm' })
  @IsNumber()
  @Min(0)
  width!: number;

  @ApiProperty({ example: 20.0, description: 'Altura em cm' })
  @IsNumber()
  @Min(0)
  height!: number;

  @ApiProperty({ example: 40.0, description: 'Comprimento em cm' })
  @IsNumber()
  @Min(0)
  length!: number;

  @ApiPropertyOptional({ example: 1000, description: 'Quantidade em estoque' })
  @IsInt()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;
}

export class StartPackingDto {
  @ApiProperty({ example: 'picking-order-uuid-1', description: 'ID da Picking Order concluída' })
  @IsString()
  @IsNotEmpty()
  pickingOrderId!: string;
}

export class CompletePackingDto {
  @ApiPropertyOptional({ example: 'material-uuid-1', description: 'ID da embalagem utilizada' })
  @IsString()
  @IsOptional()
  materialId?: string;

  @ApiProperty({ example: 2.5, description: 'Peso bruto final medido na balança em KG' })
  @IsNumber()
  @Min(0)
  grossWeight!: number;

  @ApiProperty({ example: 30.0, description: 'Largura final da caixa em cm' })
  @IsNumber()
  @Min(0)
  width!: number;

  @ApiProperty({ example: 20.0, description: 'Altura final da caixa em cm' })
  @IsNumber()
  @Min(0)
  height!: number;

  @ApiProperty({ example: 40.0, description: 'Comprimento final da caixa em cm' })
  @IsNumber()
  @Min(0)
  length!: number;

  @ApiPropertyOptional({ example: 'SEAL-987654', description: 'Código do lacre de segurança' })
  @IsString()
  @IsOptional()
  sealCode?: string;

  @ApiPropertyOptional({ example: 'Pacote protegido com plástico bolha extra' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CancelPackingOrderDto {
  @ApiProperty({ example: 'Caixa danificada durante a embalagem', description: 'Motivo do cancelamento' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
