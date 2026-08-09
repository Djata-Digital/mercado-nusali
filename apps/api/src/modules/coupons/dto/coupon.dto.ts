import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { CouponType, CouponScope, CouponStatus, SaleType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({ example: 'DESCONTO10' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'Cupom de 10% de Boas Vindas' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Válido para primeira compra', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CouponType, example: CouponType.PERCENTAGE })
  @IsNotEmpty()
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({ example: 10, description: 'Valor do desconto (percentual ou valor fixo)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ example: 'currency-uuid-brl', required: false })
  @IsOptional()
  @IsString()
  currencyId?: string;

  @ApiProperty({ enum: CouponScope, example: CouponScope.PLATFORM, required: false })
  @IsOptional()
  @IsEnum(CouponScope)
  scope?: CouponScope;

  @ApiProperty({ example: 'seller-uuid', required: false })
  @IsOptional()
  @IsString()
  sellerId?: string;

  @ApiProperty({ example: 'store-uuid', required: false })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiProperty({ example: '2026-08-01T00:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ example: 100.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @ApiProperty({ example: 50.0, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscountAmount?: number;

  @ApiProperty({ example: 100, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalUsageLimit?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimitPerUser?: number;

  @ApiProperty({ enum: CouponStatus, example: CouponStatus.ACTIVE, required: false })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;
}

export class UpdateCouponDto {
  @ApiProperty({ example: 'Novo Nome', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'Descrição', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CouponStatus, example: CouponStatus.PAUSED, required: false })
  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @ApiProperty({ example: 200, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalUsageLimit?: number;

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimitPerUser?: number;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ValidateCouponDto {
  @ApiProperty({ example: 'DESCONTO10' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 150.0, description: 'Subtotal do pedido para validação de mínimo' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiProperty({ example: 'currency-uuid-brl' })
  @IsNotEmpty()
  @IsString()
  currencyId: string;
}
