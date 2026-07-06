import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Vertical } from '../../../generated/prisma';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true';

export class ListStoresDto {
  /** Restrict to one vertical: FOOD | GROCERY | SHOP. */
  @IsOptional()
  @IsEnum(Vertical)
  vertical?: Vertical;

  /** Free-text search across store name and cuisine. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  cuisine?: string;

  /** Food filter: pure-veg stores only. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
