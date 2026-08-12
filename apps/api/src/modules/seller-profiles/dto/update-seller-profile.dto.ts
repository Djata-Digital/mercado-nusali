import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { SellerType } from '@prisma/client';

export class UpdateSellerProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiProperty({ enum: SellerType, required: false })
  @IsOptional()
  @IsEnum(SellerType)
  sellerType?: SellerType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    required: false,
    example: 'GW',
    description: 'Código ISO do país sede do vendedor',
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiProperty({
    required: false,
    example: 'XOF',
    description: 'Código da moeda principal do vendedor',
  })
  @IsOptional()
  @IsString()
  preferredCurrencyCode?: string;
}