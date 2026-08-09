import { IsIn, IsString, MinLength } from 'class-validator';

export class CreateSettlementAdjustmentDto {
  @IsString()
  @MinLength(1)
  amount!: string;

  @IsIn(['CREDIT', 'DEBIT'])
  type!: 'CREDIT' | 'DEBIT';

  @IsString()
  @MinLength(3)
  reason!: string;
}
