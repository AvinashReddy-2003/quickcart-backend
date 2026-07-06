import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateAddressDto {
  @IsOptional()
  @IsString()
  @Length(1, 30)
  label?: string;

  @IsString()
  @Length(1, 200)
  line1: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  line2?: string;

  @IsString()
  @Length(1, 60)
  city: string;

  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
