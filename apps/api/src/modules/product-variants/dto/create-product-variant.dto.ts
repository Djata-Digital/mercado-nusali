import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class CreateProductVariantDto {
  @ApiProperty({ example: 'CAS-1KG-001' })
  @IsNotEmpty()
  @IsString()
  sku: string;

  @ApiProperty({ example: 'Pacote 1kg Saco A vácuo' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 4500.0 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  price: number;

  @ApiProperty({ example: 4000.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  promotionalPrice?: number;

  @ApiProperty({ example: 3500.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  wholesalePrice?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumWholesaleQuantity?: number;

  @ApiProperty({ example: 'XOF' })
  @IsNotEmpty()
  @IsString()
  currencyCode: string;

  @ApiProperty({ example: '7891234567890', required: false })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ example: { peso: '1kg', embalagem: 'vácuo' }, required: false })
  @IsOptional()
  attributesJson?: any;
}
