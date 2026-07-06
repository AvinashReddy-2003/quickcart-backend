import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID } from 'crypto';

export interface PaymentOrder {
  id: string;
  amount: number; // paise
  currency: 'INR';
  status: string;
  mock: boolean;
}

export interface VerifyArgs {
  paymentOrderId: string;
  paymentId: string;
  signature?: string;
}

/**
 * Payment provider abstraction. Uses Razorpay when RAZORPAY_KEY_ID and
 * RAZORPAY_KEY_SECRET are configured; otherwise runs in mock mode so the
 * checkout → paid-order flow is fully testable without live keys.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly config: ConfigService) {}

  private get keyId(): string | undefined {
    return this.config.get<string>('RAZORPAY_KEY_ID');
  }

  private get keySecret(): string | undefined {
    return this.config.get<string>('RAZORPAY_KEY_SECRET');
  }

  get isMock(): boolean {
    return !this.keyId || !this.keySecret;
  }

  get publicKeyId(): string {
    return this.keyId ?? 'rzp_test_mock';
  }

  createOrder(amountPaise: number, receipt: string): PaymentOrder {
    if (this.isMock) {
      // TODO: replace with a real Razorpay Orders API call once keys exist.
      this.logger.debug(`[mock] payment order for receipt ${receipt}`);
      return {
        id: `order_mock_${randomUUID()}`,
        amount: amountPaise,
        currency: 'INR',
        status: 'created',
        mock: true,
      };
    }
    // With real keys this would call the Razorpay SDK. Kept explicit for now.
    throw new Error('Real Razorpay integration not yet wired — add SDK call.');
  }

  verifyPayment({ paymentOrderId, paymentId, signature }: VerifyArgs): boolean {
    if (this.isMock) {
      // In mock mode, accept any well-formed payment id.
      return typeof paymentId === 'string' && paymentId.length > 0;
    }
    // Real Razorpay signature check: HMAC_SHA256(order_id|payment_id, secret).
    if (!signature) return false;
    const expected = createHmac('sha256', this.keySecret!)
      .update(`${paymentOrderId}|${paymentId}`)
      .digest('hex');
    return expected === signature;
  }
}
