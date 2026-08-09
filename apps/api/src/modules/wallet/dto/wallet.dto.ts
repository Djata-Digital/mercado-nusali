import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class DepositWalletDto {
  @ApiProperty({ example: 500, description: 'Valor a ser depositado na carteira' })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 'curr-gw', description: 'ID da moeda do depósito' })
  @IsString()
  @IsNotEmpty()
  currencyId: string;

  @ApiProperty({ example: 'Depósito via Pix', description: 'Descrição do depósito', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class WithdrawWalletDto {
  @ApiProperty({ example: 200, description: 'Valor a ser sacado da carteira' })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 'curr-gw', description: 'ID da moeda do saque' })
  @IsString()
  @IsNotEmpty()
  currencyId: string;

  @ApiProperty({ example: 'Saque para conta bancária', description: 'Descrição do saque', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
