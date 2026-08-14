import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AssignRiskAlertDto {
  @IsString()
  assignedToId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
