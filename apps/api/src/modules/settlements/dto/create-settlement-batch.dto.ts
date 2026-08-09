import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateSettlementBatchDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsString()
  @MinLength(1)
  currencyId!: string;
}
