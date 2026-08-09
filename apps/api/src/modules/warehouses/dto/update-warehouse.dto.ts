import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class UpdateWarehouseDto {
  @ApiProperty({ example: 'Armazém Bissau Centro Renovado', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Bissau', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'Avenida das Nações Unidas, 45', required: false })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiProperty({ example: 15000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number;
}
