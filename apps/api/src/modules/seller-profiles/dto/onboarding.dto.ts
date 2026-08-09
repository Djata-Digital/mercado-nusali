import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsEmail } from 'class-validator';
import { SellerType } from '@prisma/client';

export class OnboardingSellerDto {
  @ApiProperty({ enum: SellerType, example: SellerType.INDIVIDUAL })
  @IsEnum(SellerType)
  sellerType: SellerType;

  @ApiProperty({ example: 'Amadou Commerce LTDA' })
  @IsNotEmpty()
  @IsString()
  legalName: string;

  @ApiProperty({ example: 'Nusali Bissau Store', required: false })
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiProperty({ example: 'NIF-12345678', required: false })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({ example: 'REG-987654', required: false })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiProperty({ example: 'GW' })
  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @ApiProperty({ example: 'business@nusali.gw', required: false })
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiProperty({ example: '+245955123456', required: false })
  @IsOptional()
  @IsString()
  businessPhone?: string;

  @ApiProperty({ example: 'https://nusali.gw', required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ example: 'Vendedor oficial de produtos locais', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
