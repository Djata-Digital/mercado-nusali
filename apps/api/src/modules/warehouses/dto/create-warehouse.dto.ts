import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { WarehouseType } from '@prisma/client';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'GW' })
  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @ApiProperty({ example: 'Armazém Bissau Centro' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'WH-GW-BIS01' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ enum: WarehouseType, example: WarehouseType.SELLER_WAREHOUSE })
  @IsEnum(WarehouseType)
  type: WarehouseType;

  @ApiProperty({ example: 'Bissau', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Avenida das Nações Unidas, 45', required: false })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiProperty({ example: 10000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number;
}
