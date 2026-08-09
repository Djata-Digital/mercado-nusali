import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ShippingQuoteItemDto {
  @ApiProperty({ example: 'variant-uuid-1' })
  @IsNotEmpty()
  @IsString()
  variantId: string;

  @ApiProperty({ example: 2 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class ShippingQuoteStoreGroupDto {
  @ApiProperty({ example: 'store-uuid-1' })
  @IsNotEmpty()
  @IsString()
  storeId: string;

  @ApiProperty({ type: [ShippingQuoteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingQuoteItemDto)
  items: ShippingQuoteItemDto[];
}

export class ShippingQuoteRequestDto {
  @ApiProperty({ example: 'address-uuid-1' })
  @IsNotEmpty()
  @IsString()
  addressId: string;

  @ApiProperty({ type: [ShippingQuoteStoreGroupDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingQuoteStoreGroupDto)
  stores?: ShippingQuoteStoreGroupDto[];
}
