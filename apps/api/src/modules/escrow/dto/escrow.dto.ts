import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReleaseEscrowDto {
  @ApiProperty({
    example: 'order-uuid',
    description:
      'ID do pedido entregue para liberar custódia',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    example: 40,
    description:
      'Valor parcial a liberar. Omitir para liberar todo o saldo retido.',
    required: false,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;
}

export class RefundEscrowDto {
  @ApiProperty({
    example: 'order-uuid',
    description:
      'ID do pedido para reembolso do saldo ainda retido',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    example: 100,
    description:
      'Valor a reembolsar. Omitir para devolver todo o saldo retido.',
    required: false,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  amount?: number;
}

export class DisputeEscrowDto {
  @ApiProperty({
    example: 'order-uuid',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    required: false,
    example:
      'Produto recebido não corresponde ao anúncio.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class ResolveEscrowDisputeDto
  extends DisputeEscrowDto {
  @ApiProperty({
    enum: [
      'BUYER_WINS',
      'SELLER_WINS',
    ],
  })
  @IsIn([
    'BUYER_WINS',
    'SELLER_WINS',
  ])
  outcome:
    | 'BUYER_WINS'
    | 'SELLER_WINS';

  @ApiProperty({
    required: false,
    example:
      'Evidências analisadas e decisão administrativa registrada.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}

export class AdminDisputeMessageDto {
  @ApiProperty({
    example:
      'Após análise das evidências, solicitamos esclarecimento complementar.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'Mensagem privada visível somente à administração.',
  })
  @IsOptional()
  isPrivate?: boolean;
}

export class AdminResolveDisputeDto {
  @ApiProperty({
    enum: [
      'BUYER_WINS',
      'SELLER_WINS',
    ],
  })
  @IsIn([
    'BUYER_WINS',
    'SELLER_WINS',
  ])
  outcome:
    | 'BUYER_WINS'
    | 'SELLER_WINS';

  @ApiProperty({
    required: false,
    example:
      'Decisão tomada após análise das evidências.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}