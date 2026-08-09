import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class FinancialReconciliationRecoveryDto {
  @IsIn(['RECHECK', 'AUTO_RESOLVE_IF_HEALTHY'])
  action!: 'RECHECK' | 'AUTO_RESOLVE_IF_HEALTHY';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
