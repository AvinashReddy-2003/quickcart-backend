import { BadRequestException, Injectable } from '@nestjs/common';
import { Vertical } from '../../generated/prisma';

export interface BillLine {
  lineTotalPaise: number;
}

export interface Bill {
  subtotalPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  totalPaise: number;
  couponCode?: string;
}

interface Coupon {
  code: string;
  minSubtotalPaise: number;
  /** Flat amount off, in paise. */
  flatPaise?: number;
  /** Percent off (0–100), capped by maxDiscountPaise. */
  percent?: number;
  maxDiscountPaise?: number;
  description: string;
}

// A small hard-coded coupon book. Move to a table when marketing needs it.
const COUPONS: Record<string, Coupon> = {
  WELCOME50: {
    code: 'WELCOME50',
    minSubtotalPaise: 19900,
    flatPaise: 5000,
    description: '₹50 off on orders above ₹199',
  },
  SAVE10: {
    code: 'SAVE10',
    minSubtotalPaise: 29900,
    percent: 10,
    maxDiscountPaise: 10000,
    description: '10% off (up to ₹100) on orders above ₹299',
  },
};

@Injectable()
export class PricingService {
  static toPaise(rupees: number | string): number {
    return Math.round(Number(rupees) * 100);
  }

  static toRupees(paise: number): number {
    return Math.round(paise) / 100;
  }

  deliveryFeePaise(vertical: Vertical, subtotalPaise: number): number {
    // SHOP (e-commerce): free over ₹500, else ₹49. FOOD/GROCERY: flat ₹40.
    if (vertical === Vertical.SHOP) {
      return subtotalPaise >= 50000 ? 0 : 4900;
    }
    return 4000;
  }

  /** Validate a coupon against the subtotal; throws if not applicable. */
  validateCoupon(code: string, subtotalPaise: number): number {
    const coupon = COUPONS[code.toUpperCase()];
    if (!coupon) {
      throw new BadRequestException(`Invalid coupon code: ${code}`);
    }
    if (subtotalPaise < coupon.minSubtotalPaise) {
      throw new BadRequestException(
        `Coupon ${coupon.code} needs a minimum order of ₹${PricingService.toRupees(coupon.minSubtotalPaise)}`,
      );
    }
    let discount = coupon.flatPaise ?? 0;
    if (coupon.percent) {
      discount = Math.round((subtotalPaise * coupon.percent) / 100);
      if (coupon.maxDiscountPaise) {
        discount = Math.min(discount, coupon.maxDiscountPaise);
      }
    }
    return Math.min(discount, subtotalPaise);
  }

  buildBill(
    lines: BillLine[],
    vertical: Vertical,
    couponCode?: string,
  ): Bill {
    const subtotalPaise = lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
    const deliveryFeePaise = this.deliveryFeePaise(vertical, subtotalPaise);
    const discountPaise = couponCode
      ? this.validateCoupon(couponCode, subtotalPaise)
      : 0;
    const totalPaise = Math.max(
      0,
      subtotalPaise + deliveryFeePaise - discountPaise,
    );
    return {
      subtotalPaise,
      deliveryFeePaise,
      discountPaise,
      totalPaise,
      couponCode: couponCode ? couponCode.toUpperCase() : undefined,
    };
  }
}
