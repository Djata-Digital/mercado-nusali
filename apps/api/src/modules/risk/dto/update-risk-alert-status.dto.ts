import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RiskAlertStatus } from '@prisma/client';

export class UpdateRiskAlertStatusDto {
  @IsEnum(RiskAlertStatus)
  status: RiskAlertStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
