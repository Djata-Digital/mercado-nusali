import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ReleaseEscrowDto {
  @ApiProperty({ example: 'order-uuid', description: 'ID do pedido entregue para liberar custódia' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 40, description: 'Valor parcial a liberar. Omitir para liberar todo o saldo retido.', required: false })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;
}

export class RefundEscrowDto {
  @ApiProperty({ example: 'order-uuid', description: 'ID do pedido para reembolso do saldo ainda retido' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 100, description: 'Valor a reembolsar. Omitir para devolver todo o saldo retido.', required: false })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;
}

export class DisputeEscrowDto {
  @ApiProperty({ example: 'order-uuid' })
  @IsString()
  @IsNotEmpty()
  orderId: string;
}

export class ResolveEscrowDisputeDto extends DisputeEscrowDto {
  @ApiProperty({ enum: ['BUYER_WINS', 'SELLER_WINS'] })
  @IsIn(['BUYER_WINS', 'SELLER_WINS'])
  outcome: 'BUYER_WINS' | 'SELLER_WINS';
}
