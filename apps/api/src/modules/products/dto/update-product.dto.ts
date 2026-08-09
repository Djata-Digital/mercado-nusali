import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { ProductCondition, ProductType, SaleScope, SaleType } from '@prisma/client';

export class UpdateProductDto {
  @ApiProperty({ example: 'category-uuid-1', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: 'brand-uuid-1', required: false })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({ example: 'Castanha de Caju Premium 1kg', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Castanha de caju de alta qualidade.', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ProductCondition, example: ProductCondition.NEW, required: false })
  @IsOptional()
  @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @ApiProperty({ enum: ProductType, example: ProductType.PHYSICAL, required: false })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;

  @ApiProperty({ enum: SaleScope, example: SaleScope.BOTH, required: false })
  @IsOptional()
  @IsEnum(SaleScope)
  saleScope?: SaleScope;

  @ApiProperty({ enum: SaleType, example: SaleType.RETAIL, required: false })
  @IsOptional()
  @IsEnum(SaleType)
  saleType?: SaleType;

  @ApiProperty({ example: 'GW', required: false })
  @IsOptional()
  @IsString()
  countryOfOriginCode?: string;

  @ApiProperty({ example: 1.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;
}
