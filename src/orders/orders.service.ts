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
import { SimulationService } from '../tracking/simulation.service';
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
    private readonly simulation: SimulationService,
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

    // Kick off the (simulated) delivery: rider assignment + live tracking.
    void this.simulation.start(order.id);

    return this.getOne(userId, order.id);
  }

  /** Current delivery state for a map: order status, rider, live location. */
  async getTracking(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: userId },
      include: {
        store: { select: { name: true, latitude: true, longitude: true } },
        address: { select: { latitude: true, longitude: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const live = this.simulation.getState(orderId);
    const lat = live?.lat ?? order.riderLat ?? null;
    const lng = live?.lng ?? order.riderLng ?? null;

    return {
      orderId: order.id,
      status: live?.status ?? order.status,
      paymentStatus: order.paymentStatus,
      rider: order.riderName
        ? {
            name: order.riderName,
            phone: order.riderPhone,
            vehicle: order.riderVehicle,
          }
        : null,
      riderLocation: lat !== null && lng !== null ? { lat, lng } : null,
      store: {
        name: order.store.name,
        lat: order.store.latitude,
        lng: order.store.longitude,
      },
      destination: order.address
        ? { lat: order.address.latitude, lng: order.address.longitude }
        : null,
    };
  }

  /** Repopulate the cart from a past order (skips unavailable items). */
  async reorder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: userId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.cart.clear(userId);
    const skipped: string[] = [];
    for (const item of order.items) {
      try {
        await this.cart.add(userId, item.productId, item.quantity);
      } catch {
        skipped.push(item.productId);
      }
    }
    return { cart: await this.cart.getDetailed(userId), skipped };
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
