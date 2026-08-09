import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateRefundDto {
  @ApiProperty({ example: 'payment-uuid', description: 'ID do pagamento a ser reembolsado' })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiProperty({ example: 'order-uuid', description: 'ID do pedido a ser reembolsado' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 100, description: 'Valor a ser reembolsado (deixe vazio para reembolso total)', required: false })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;

  @ApiProperty({ example: 'Produto danificado no transporte', description: 'Motivo do reembolso', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
