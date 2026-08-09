import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { PaymentMethodType, PaymentProvider } from '@prisma/client';

export class CreatePaymentIntentDto {
  @ApiProperty({ example: 'order-group-uuid', description: 'ID do grupo de pedidos a ser pago' })
  @IsString()
  @IsNotEmpty()
  orderGroupId: string;
}

export class ProcessPaymentDto {
  @ApiProperty({ example: 'payment-intent-uuid', description: 'ID da intenção de pagamento' })
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;

  @ApiProperty({ enum: PaymentMethodType, example: PaymentMethodType.ORANGE_MONEY, description: 'Método de pagamento escolhido' })
  @IsEnum(PaymentMethodType)
  @IsNotEmpty()
  method: PaymentMethodType;

  @ApiProperty({ example: { phoneNumber: '955123456' }, description: 'Metadados adicionais para o provedor', required: false })
  @IsObject()
  @IsOptional()
  metadata?: any;
}

export class CapturePaymentDto {
  @ApiProperty({ example: 'payment-uuid', description: 'ID do pagamento a ser capturado' })
  @IsString()
  @IsNotEmpty()
  paymentId: string;
}
