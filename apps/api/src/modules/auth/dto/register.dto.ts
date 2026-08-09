import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsBoolean, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'GW' })
  @IsNotEmpty()
  @IsString()
  country: string;

  @ApiProperty({ example: 'BUYER', description: 'BUYER ou SELLER' })
  @IsNotEmpty()
  @IsString()
  role: string;

  @ApiProperty({ example: 'Amadou' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Diallo' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'amadou@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '955123456' })
  @IsNotEmpty()
  @IsString()
  phone: string;

  @ApiProperty({ example: '+245' })
  @IsNotEmpty()
  @IsString()
  phoneCode: string;

  @ApiPropertyOptional({ example: '1995-05-15' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({ example: 'SenhaSegura123!' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  termsAccepted: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  privacyAccepted: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
