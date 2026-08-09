import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class WebhookPayloadDto {
  @ApiProperty({ example: 'evt_100200300', description: 'ID único do evento no provedor' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({ example: 'payment.captured', description: 'Tipo do evento enviado pelo webhook' })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({ example: { paymentId: 'payment-uuid', status: 'CAPTURED' }, description: 'Payload JSON da notificação' })
  @IsObject()
  @IsNotEmpty()
  payload: any;
}
