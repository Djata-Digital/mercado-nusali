import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, IsUrl } from 'class-validator';

export class UpdateStoreDto {
  @ApiProperty({ example: 'Loja Nusali Bissau', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Venda de castanha e produtos agrícolas de Bissau', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'contato@lojanusali.com', required: false })
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

  @ApiProperty({ example: 'Avenida Amílcar Cabral, 120', required: false })
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
