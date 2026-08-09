import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'amadou@example.com' })
  @IsNotEmpty()
  @IsString()
  identifier: string;

  @ApiProperty({ example: 'SenhaSegura123!' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'BUYER' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
