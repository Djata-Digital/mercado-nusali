import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class ResetPasswordDto {
  @ApiPropertyOptional({ example: 'reset_token_string' })
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'NovaSenhaSegura123!' })
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
