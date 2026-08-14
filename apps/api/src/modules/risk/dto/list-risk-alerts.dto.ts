import { IsOptional, IsInt, IsEnum, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import {
  RiskAlertType,
  RiskAlertStatus,
  RiskSeverity,
  RiskEntityType,
} from '@prisma/client';

export class ListRiskAlertsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(RiskAlertStatus)
  status?: RiskAlertStatus;

  @IsOptional()
  @IsEnum(RiskSeverity)
  severity?: RiskSeverity;

  @IsOptional()
  @IsEnum(RiskAlertType)
  type?: RiskAlertType;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsEnum(RiskEntityType)
  entityType?: RiskEntityType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore?: number;
}
