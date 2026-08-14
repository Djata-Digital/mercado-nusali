import { ApiProperty } from '@nestjs/swagger';

import {
  ReturnInspectionDecision,
  ReturnReason,
  ReturnStatus,
} from '@prisma/client';

import { Type } from 'class-transformer';

import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateReturnItemDto {
  @ApiProperty({
    example: 'order-item-uuid',
  })
  @IsString()
  @IsNotEmpty()
  orderItemId!: string;

  @ApiProperty({
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    enum: ReturnReason,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReturnReason)
  reason?: ReturnReason;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateReturnRequestDto {
  @ApiProperty({
    example: 'order-uuid',
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({
    enum: ReturnReason,
  })
  @IsEnum(ReturnReason)
  reason!: ReturnReason;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reasonDetails?: string;

  @ApiProperty({
    type: [CreateReturnItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({
    each: true,
  })
  @Type(
    () => CreateReturnItemDto,
  )
  items!: CreateReturnItemDto[];
}

export class AdminAuthorizeReturnDto {
  @ApiProperty({
    required: false,
    example: 'NUSALI-RET-123456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  reverseTrackingCode?: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  carrierId?: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  returnWarehouseId?: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class AdminRejectReturnDto {
  @ApiProperty({
    example:
      'Solicitação fora das condições de devolução.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  reason!: string;
}

export class ReturnStatusUpdateDto {
  @ApiProperty({
    enum: ReturnStatus,
  })
  @IsEnum(ReturnStatus)
  status!: ReturnStatus;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class AdminInspectReturnDto {
  @ApiProperty({
    enum:
      ReturnInspectionDecision,
  })
  @IsEnum(
    ReturnInspectionDecision,
  )
  decision!: ReturnInspectionDecision;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class AdminReturnListQueryDto {
  @ApiProperty({
    enum: ReturnStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @ApiProperty({
    required: false,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;
}