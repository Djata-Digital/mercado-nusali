import {
  IsEnum,
  IsInt,
  IsString,
  IsOptional,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import {
  RiskAlertType,
  RiskAlertStatus,
  RiskSeverity,
  RiskEntityType,
} from '@prisma/client';

export class CreateRiskAlertDto {
  @IsEnum(RiskAlertType)
  type: RiskAlertType;

  @IsEnum(RiskSeverity)
  severity: RiskSeverity;

  @IsOptional()
  @IsEnum(RiskAlertStatus)
  status?: RiskAlertStatus;

  @IsInt()
  @Min(0)
  @Max(100)
  riskScore: number;

  @IsEnum(RiskEntityType)
  entityType: RiskEntityType;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  payoutId?: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  ruleCode?: string;

  @IsOptional()
  @IsString()
  dedupeKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
