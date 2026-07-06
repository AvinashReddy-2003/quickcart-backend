import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true';

export class ProductQueryDto {
  /** Free-text search across product name and description. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** Food filter: vegetarian items only. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isVeg?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}
