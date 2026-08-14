import { ApiProperty } from '@nestjs/swagger';

import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';

import { Type } from 'class-transformer';

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSupportTicketDto {
  @ApiProperty({
    enum: SupportTicketCategory,
  })
  @IsEnum(SupportTicketCategory)
  category!: SupportTicketCategory;

  @ApiProperty({
    example: 'Problema com meu pedido',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    example:
      'Meu pedido consta como entregue, mas eu ainda não o recebi.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  returnRequestId?: string;
}

export class CreateSupportMessageDto {
  @ApiProperty({
    example:
      'Olá. Estamos analisando o seu chamado.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  @ApiProperty({
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class AssignSupportTicketDto {
  @ApiProperty({
    example: 'user-uuid',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

export class UpdateSupportStatusDto {
  @ApiProperty({
    enum: SupportTicketStatus,
  })
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class UpdateSupportPriorityDto {
  @ApiProperty({
    enum: SupportTicketPriority,
  })
  @IsEnum(SupportTicketPriority)
  priority!: SupportTicketPriority;
}

export class AdminSupportListQueryDto {
  @ApiProperty({
    enum: SupportTicketStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @ApiProperty({
    enum: SupportTicketPriority,
    required: false,
  })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @ApiProperty({
    enum: SupportTicketCategory,
    required: false,
  })
  @IsOptional()
  @IsEnum(SupportTicketCategory)
  category?: SupportTicketCategory;

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