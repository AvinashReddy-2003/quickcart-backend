import { IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyPaymentDto {
  @IsUUID()
  orderId: string;

  // Razorpay payment id (e.g. "pay_XXXX"). In mock mode any non-empty value works.
  @IsString()
  paymentId: string;

  @IsOptional()
  @IsString()
  signature?: string;
}
