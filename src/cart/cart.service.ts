import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PricingService } from '../pricing/pricing.service';

interface CartState {
  storeId: string;
  // productId -> quantity
  items: Record<string, number>;
}

// Carts live for 7 days of inactivity.
const CART_TTL_SECONDS = 60 * 60 * 24 * 7;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly pricing: PricingService,
  ) {}

  private key(userId: string) {
    return `cart:${userId}`;
  }

  private async read(userId: string): Promise<CartState | null> {
    const raw = await this.redis.get(this.key(userId));
    return raw ? (JSON.parse(raw) as CartState) : null;
  }

  private async write(userId: string, state: CartState) {
    await this.redis.setWithTtl(
      this.key(userId),
      JSON.stringify(state),
      CART_TTL_SECONDS,
    );
  }

  async add(userId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (!product.inStock) {
      throw new BadRequestException(`${product.name} is out of stock`);
    }

    const cart = (await this.read(userId)) ?? {
      storeId: product.storeId,
      items: {},
    };
    if (cart.storeId !== product.storeId) {
      throw new ConflictException(
        'Your cart has items from another store. Clear it before adding items from a different store.',
      );
    }

    cart.items[productId] = (cart.items[productId] ?? 0) + quantity;
    await this.write(userId, cart);
    return this.getDetailed(userId);
  }

  async updateItem(userId: string, productId: string, quantity: number) {
    const cart = await this.read(userId);
    if (!cart || cart.items[productId] === undefined) {
      throw new NotFoundException('Item not in cart');
    }
    if (quantity === 0) {
      delete cart.items[productId];
    } else {
      cart.items[productId] = quantity;
    }
    if (Object.keys(cart.items).length === 0) {
      await this.clear(userId);
      return this.getDetailed(userId);
    }
    await this.write(userId, cart);
    return this.getDetailed(userId);
  }

  async removeItem(userId: string, productId: string) {
    return this.updateItem(userId, productId, 0);
  }

  async clear(userId: string) {
    await this.redis.del(this.key(userId));
  }

  /**
   * Build the full cart view with a server-side bill.
   * Prices always come from the database — never from the client.
   * `couponCode` is validated here and throws if not applicable.
   */
  async getDetailed(userId: string, couponCode?: string) {
    const cart = await this.read(userId);
    if (!cart || Object.keys(cart.items).length === 0) {
      return { storeId: null, store: null, items: [], bill: null };
    }

    const store = await this.prisma.store.findUnique({
      where: { id: cart.storeId },
    });
    const products = await this.prisma.product.findMany({
      where: { id: { in: Object.keys(cart.items) } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const items = Object.entries(cart.items)
      .map(([productId, qty]) => {
        const product = byId.get(productId);
        if (!product) return null;
        const unitPricePaise = PricingService.toPaise(product.price.toString());
        const lineTotalPaise = unitPricePaise * qty;
        return {
          productId,
          name: product.name,
          unitPrice: PricingService.toRupees(unitPricePaise),
          quantity: qty,
          lineTotal: PricingService.toRupees(lineTotalPaise),
          inStock: product.inStock,
          lineTotalPaise,
        };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null && i.inStock);

    const bill = this.pricing.buildBill(
      items,
      store!.vertical,
      couponCode,
    );

    return {
      storeId: cart.storeId,
      store: store
        ? { id: store.id, name: store.name, vertical: store.vertical }
        : null,
      items: items.map(({ lineTotalPaise, inStock, ...rest }) => rest),
      bill: {
        subtotal: PricingService.toRupees(bill.subtotalPaise),
        deliveryFee: PricingService.toRupees(bill.deliveryFeePaise),
        discount: PricingService.toRupees(bill.discountPaise),
        total: PricingService.toRupees(bill.totalPaise),
        savings: PricingService.toRupees(bill.discountPaise),
        couponCode: bill.couponCode ?? null,
      },
    };
  }
}
