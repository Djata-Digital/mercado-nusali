import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCycleCountDto {
  @ApiProperty({ example: 'warehouse-hub-id', description: 'ID do HUB' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiPropertyOptional({ example: 'zone-storage-id', description: 'ID da Zona Logística (opcional)' })
  @IsString()
  @IsOptional()
  zoneId?: string;

  @ApiPropertyOptional({ example: 'auditor-user-id', description: 'ID do auditor atribuído' })
  @IsString()
  @IsOptional()
  assignedAuditorId?: string;

  @ApiPropertyOptional({ example: '2026-08-15T08:00:00.000Z', description: 'Data agendada para contagem' })
  @IsOptional()
  scheduledDate?: string;
}

export class SubmitCountItemDto {
  @ApiProperty({ example: 'cycle-count-item-id', description: 'ID do item do inventário cíclico' })
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @ApiProperty({ example: 48, description: 'Quantidade contada fisicamente' })
  @IsInt()
  @Min(0)
  countedQuantity!: number;

  @ApiPropertyOptional({ example: 49, description: 'Quantidade de recontagem (se solicitada)' })
  @IsInt()
  @Min(0)
  @IsOptional()
  recountQuantity?: number;

  @ApiPropertyOptional({ example: 'Caixa danificada no fundo da estante' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubmitCycleCountDto {
  @ApiProperty({ type: [SubmitCountItemDto], description: 'Lista de contagens efetuadas' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitCountItemDto)
  items!: SubmitCountItemDto[];
}
