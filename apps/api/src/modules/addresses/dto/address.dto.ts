import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { AddressType } from '@prisma/client';

export class CreateAddressDto {
  @ApiProperty({ example: 'Minha Casa', required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'João da Silva' })
  @IsNotEmpty()
  @IsString()
  recipientName: string;

  @ApiProperty({ example: '955123456' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: '+245' })
  @IsNotEmpty()
  @IsString()
  phoneCode: string;

  @ApiProperty({ example: 'country-uuid-gw' })
  @IsNotEmpty()
  @IsString()
  countryId: string;

  @ApiProperty({ example: 'Bissau' })
  @IsNotEmpty()
  @IsString()
  region: string;

  @ApiProperty({ example: 'Bissau' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({ example: 'Bairro de Belém', required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ example: 'Bandim', required: false })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiProperty({ example: 'Avenida Amílcar Cabral' })
  @IsNotEmpty()
  @IsString()
  street: string;

  @ApiProperty({ example: '100' })
  @IsNotEmpty()
  @IsString()
  number: string;

  @ApiProperty({ example: 'Bloco A, Ap 12', required: false })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({ example: '1000', required: false })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ example: 'Próximo ao Mercado Central', required: false })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ example: 11.8636, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({ example: -15.5977, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ enum: AddressType, example: AddressType.RESIDENTIAL, required: false })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;
}

export class UpdateAddressDto {
  @ApiProperty({ example: 'Casa de Praia', required: false })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'João da Silva', required: false })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiProperty({ example: '955123456', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '+245', required: false })
  @IsOptional()
  @IsString()
  phoneCode?: string;

  @ApiProperty({ example: 'Bissau', required: false })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ example: 'Bissau', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Bairro de Belém', required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ example: 'Bandim', required: false })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiProperty({ example: 'Avenida Amílcar Cabral', required: false })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiProperty({ example: '100', required: false })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiProperty({ example: 'Bloco A, Ap 12', required: false })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty({ example: '1000', required: false })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ example: 'Próximo ao Mercado Central', required: false })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ example: 11.8636, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({ example: -15.5977, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ enum: AddressType, example: AddressType.RESIDENTIAL, required: false })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;
}
