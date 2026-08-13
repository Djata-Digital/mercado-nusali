import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminListUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsIn(['active', 'blocked', 'suspended', 'inactive'])
  status?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;
}

export class AdminCreateUserDto {
  @IsString()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @MinLength(2)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(5)
  phone!: string;

  @IsString()
  phoneCode!: string;

  @IsString()
  countryCode!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles!: string[];
}

export class AdminUpdateUserStatusDto {
  @IsIn(['active', 'blocked', 'suspended', 'inactive'])
  status!: 'active' | 'blocked' | 'suspended' | 'inactive';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminUpdateUserRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles!: string[];
}