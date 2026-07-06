import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AddressesService } from '../addresses/addresses.service';
import { PaymentService } from '../payments/payment.service';
import { PricingService } from '../pricing/pricing.service';
import { PaymentStatus } from '../../generated/prisma';
import { CheckoutDto } from './dto/checkout.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly addresses: AddressesService,
    private readonly payment: PaymentService,
  ) {}

  /**
   * Turn the cart into a persisted order and open a payment.
   * The bill is recomputed server-side from database prices.
   */
  async checkout(userId: string, dto: CheckoutDto) {
    const detailed = await this.cart.getDetailed(userId, dto.couponCode);
    if (!detailed.bill || detailed.items.length === 0 || !detailed.storeId) {
      throw new BadRequestException('Your cart is empty');
    }

    const address = await this.addresses.findOne(userId, dto.addressId);
    if (!AddressesService.isServiceable(address.pincode)) {
      throw new UnprocessableEntityException(
        `We do not deliver to ${address.pincode} yet`,
      );
    }

    const totalPaise = PricingService.toPaise(detailed.bill.total);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId: userId,
          storeId: detailed.storeId!,
          addressId: address.id,
          subtotal: detailed.bill!.subtotal,
          deliveryFee: detailed.bill!.deliveryFee,
          discount: detailed.bill!.discount,
          total: detailed.bill!.total,
          couponCode: detailed.bill!.couponCode,
          paymentStatus: PaymentStatus.PENDING,
          items: {
            create: detailed.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          },
        },
      });

      const paymentOrder = this.payment.createOrder(totalPaise, created.id);
      return tx.order.update({
        where: { id: created.id },
        data: { paymentOrderId: paymentOrder.id },
        include: { items: true },
      });
    });

    return {
      order,
      payment: {
        provider: this.payment.isMock ? 'mock' : 'razorpay',
        keyId: this.payment.publicKeyId,
        paymentOrderId: order.paymentOrderId,
        amount: totalPaise,
        currency: 'INR',
      },
    };
  }

  /**
   * Confirm payment and mark the order paid. Idempotent: verifying an
   * already-paid order returns it unchanged (guards against double charges).
   */
  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, customerId: userId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      return this.getOne(userId, order.id);
    }

    const ok = this.payment.verifyPayment({
      paymentOrderId: order.paymentOrderId ?? '',
      paymentId: dto.paymentId,
      signature: dto.signature,
    });

    if (!ok) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: PaymentStatus.FAILED },
      });
      throw new BadRequestException('Payment verification failed');
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.PAID, paymentId: dto.paymentId },
    });

    // Payment succeeded — the cart has become this order.
    await this.cart.clear(userId);
    return this.getOne(userId, order.id);
  }

  listMine(userId: string) {
    return this.prisma.order.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { id: true, name: true, vertical: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });
  }

  async getOne(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, customerId: userId },
      include: {
        store: { select: { id: true, name: true, vertical: true } },
        address: true,
        items: { include: { product: { select: { name: true } } } },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
}
