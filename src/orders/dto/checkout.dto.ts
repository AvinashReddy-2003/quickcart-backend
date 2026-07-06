import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  addressId: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
