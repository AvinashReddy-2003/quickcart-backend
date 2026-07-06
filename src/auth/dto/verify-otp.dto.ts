import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Role } from '../../../generated/prisma';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: 'phone must be a valid number' })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'code must be 6 digits' })
  code: string;

  // Optional role for first-time signup; defaults to CUSTOMER.
  // ADMIN cannot be self-assigned here.
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
