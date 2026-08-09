import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FinancialIncidentListQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class FinancialIncidentResolveDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class FinancialReconciliationScanDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
