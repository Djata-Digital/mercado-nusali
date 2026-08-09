import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SellerStatus } from '@prisma/client';

export class UpdateSellerStatusDto {
  @ApiProperty({ enum: SellerStatus, example: SellerStatus.VERIFIED })
  @IsNotEmpty()
  @IsEnum(SellerStatus)
  status: SellerStatus;

  @ApiProperty({ example: 'Documentação validada com sucesso.', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
