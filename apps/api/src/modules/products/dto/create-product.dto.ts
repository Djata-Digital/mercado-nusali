import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ProductCondition, ProductType, SaleScope, SaleType } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ example: 'store-uuid-1' })
  @IsNotEmpty()
  @IsString()
  storeId: string;

  @ApiProperty({ example: 'category-uuid-1' })
  @IsNotEmpty()
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 'brand-uuid-1', required: false })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({ example: 'Castanha de Caju Premium 1kg' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'castanha-de-caju-premium-1kg' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ example: 'Castanha de caju de alta qualidade produzida na Guiné-Bissau.' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ enum: ProductCondition, example: ProductCondition.NEW })
  @IsEnum(ProductCondition)
  condition: ProductCondition;

  @ApiProperty({ enum: ProductType, example: ProductType.PHYSICAL })
  @IsEnum(ProductType)
  productType: ProductType;

  @ApiProperty({ enum: SaleScope, example: SaleScope.BOTH })
  @IsEnum(SaleScope)
  saleScope: SaleScope;

  @ApiProperty({ enum: SaleType, example: SaleType.RETAIL })
  @IsEnum(SaleType)
  saleType: SaleType;

  @ApiProperty({ example: 'GW', required: false })
  @IsOptional()
  @IsString()
  countryOfOriginCode?: string;

  @ApiProperty({ example: 1.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;
}
