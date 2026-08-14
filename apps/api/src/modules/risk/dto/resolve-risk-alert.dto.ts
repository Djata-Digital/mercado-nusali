import { IsEnum, IsString, IsOptional, MaxLength } from 'class-validator';
import { RiskAlertStatus } from '@prisma/client';

export class ResolveRiskAlertDto {
  @IsEnum(RiskAlertStatus)
  status: RiskAlertStatus;

  @IsString()
  @MaxLength(1000)
  resolution: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
