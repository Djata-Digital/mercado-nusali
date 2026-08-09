import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEmail, IsUrl } from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({ example: 'Loja Nusali Bissau' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'loja-nusali-bissau' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ example: 'GW' })
  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @ApiProperty({ example: 'Loja oficial de produtos locais', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'loja@nusali.gw', required: false })
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiProperty({ example: '+245955123456', required: false })
  @IsOptional()
  @IsString()
  businessPhone?: string;

  @ApiProperty({ example: 'https://lojanusali.com', required: false })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({ example: 'Rua de Lisboa, 10', required: false })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiProperty({ example: 'Bissau', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Bissau', required: false })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ example: 'Africa/Bissau', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;
}
