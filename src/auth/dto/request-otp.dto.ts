import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  // E.164-ish: optional +, 10-15 digits.
  @IsString()
  @Matches(/^\+?[1-9]\d{9,14}$/, { message: 'phone must be a valid number' })
  phone: string;
}
