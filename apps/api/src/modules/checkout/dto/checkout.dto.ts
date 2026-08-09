import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutPreviewDto {
  @ApiProperty({ example: 'address-uuid-1' })
  @IsNotEmpty()
  @IsString()
  addressId: string;
}

export class CheckoutConfirmShippingSelectionDto {
  @ApiProperty({ example: 'store-uuid-1' })
  @IsNotEmpty()
  @IsString()
  storeId: string;

  @ApiProperty({ example: 'STANDARD' })
  @IsNotEmpty()
  @IsString()
  serviceCode: string;
}

export class CheckoutConfirmDto {
  @ApiProperty({ example: 'checkout-session-uuid-1' })
  @IsNotEmpty()
  @IsString()
  checkoutSessionId: string;

  @ApiProperty({ type: [CheckoutConfirmShippingSelectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutConfirmShippingSelectionDto)
  shippingSelections: CheckoutConfirmShippingSelectionDto[];
}
