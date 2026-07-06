import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateItemDto {
  // 0 removes the line.
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  quantity: number;
}
