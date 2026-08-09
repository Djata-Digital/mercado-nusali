import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RequestPayoutDto {
  @ApiProperty({ example: 500, description: 'Valor a ser sacado da conta do vendedor' })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 'curr-gw', description: 'ID da moeda para o saque' })
  @IsString()
  @IsNotEmpty()
  currencyId: string;

  @ApiProperty({ example: 'BANK_TRANSFER', description: 'Método de repasse bancário', required: false })
  @IsString()
  @IsOptional()
  payoutMethod?: string;
}
