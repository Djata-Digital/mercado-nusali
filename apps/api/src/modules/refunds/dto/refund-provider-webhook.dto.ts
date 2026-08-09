import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class RefundProviderWebhookDto {
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  signature?: string;
}
