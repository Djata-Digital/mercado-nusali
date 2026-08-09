import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'email', description: 'email ou phone' })
  @IsNotEmpty()
  @IsString()
  type: 'email' | 'phone';
}
