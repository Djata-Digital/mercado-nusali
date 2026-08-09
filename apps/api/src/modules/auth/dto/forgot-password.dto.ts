import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'amadou@example.com' })
  @IsNotEmpty()
  @IsString()
  identifier: string;

  @ApiPropertyOptional({ example: 'email', description: 'email, sms, whatsapp' })
  @IsOptional()
  @IsString()
  method?: 'email' | 'sms' | 'whatsapp';
}
