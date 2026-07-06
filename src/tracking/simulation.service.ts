import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../../generated/prisma';
import {
  DEFAULT_DROP,
  DEFAULT_STORE,
  MOVE_STEPS,
  PERSIST_EVERY,
  PREPARING_MS,
  Rider,
  RIDER_POOL,
  STEP_MS,
} from './tracking.constants';

interface SimState {
  orderId: string;
  status: OrderStatus;
  rider: Rider;
  lat: number;
  lng: number;
  dest: { lat: number; lng: number };
  timers: NodeJS.Timeout[];
}

export function room(orderId: string) {
  return `order:${orderId}`;
}

/**
 * Drives an order through its delivery lifecycle with a fake rider that
 * "moves" from the store to the customer, streaming updates over WebSockets.
 * Runs server-side and independent of any connected client.
 */
@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);
  private readonly sims = new Map<string, SimState>();
  private server?: Server;

  constructor(private readonly prisma: PrismaService) {}

  setServer(server: Server) {
    this.server = server;
  }

  getState(orderId: string): SimState | undefined {
    return this.sims.get(orderId);
  }

  private emit(orderId: string, event: string, payload: unknown) {
    this.server?.to(room(orderId)).emit(event, payload);
  }

  private pickRider(orderId: string): Rider {
    let hash = 0;
    for (const ch of orderId) hash = (hash + ch.charCodeAt(0)) % RIDER_POOL.length;
    return RIDER_POOL[hash];
  }

  /** Begin simulating delivery for a paid order. Idempotent per order. */
  async start(orderId: string) {
    if (this.sims.has(orderId)) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { store: true, address: true },
    });
    if (!order || order.status === OrderStatus.DELIVERED) return;

    const origin = {
      lat: order.store.latitude ?? DEFAULT_STORE.lat,
      lng: order.store.longitude ?? DEFAULT_STORE.lng,
    };
    const dest = {
      lat: order.address?.latitude ?? DEFAULT_DROP.lat,
      lng: order.address?.longitude ?? DEFAULT_DROP.lng,
    };
    const rider = this.pickRider(orderId);

    const state: SimState = {
      orderId,
      status: OrderStatus.PREPARING,
      rider,
      lat: origin.lat,
      lng: origin.lng,
      dest,
      timers: [],
    };
    this.sims.set(orderId, state);

    // Stage 1: PREPARING — rider assigned, waiting at the store.
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.PREPARING,
        riderName: rider.name,
        riderPhone: rider.phone,
        riderVehicle: rider.vehicle,
        riderLat: origin.lat,
        riderLng: origin.lng,
      },
    });
    this.emit(orderId, 'order:status', { orderId, status: OrderStatus.PREPARING });
    this.emit(orderId, 'rider:assigned', { orderId, rider });

    // Stage 2: after prep, pick up and move toward the customer.
    state.timers.push(
      setTimeout(() => void this.beginMovement(orderId, origin, dest), PREPARING_MS),
    );
  }

  private async beginMovement(
    orderId: string,
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
  ) {
    const state = this.sims.get(orderId);
    if (!state) return;

    state.status = OrderStatus.OUT_FOR_DELIVERY;
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.OUT_FOR_DELIVERY },
    });
    this.emit(orderId, 'order:status', {
      orderId,
      status: OrderStatus.OUT_FOR_DELIVERY,
    });

    let step = 0;
    const tick = async () => {
      const s = this.sims.get(orderId);
      if (!s) return;
      step += 1;
      const t = step / MOVE_STEPS;
      s.lat = origin.lat + (dest.lat - origin.lat) * t;
      s.lng = origin.lng + (dest.lng - origin.lng) * t;
      this.emit(orderId, 'rider:location', {
        orderId,
        lat: Number(s.lat.toFixed(6)),
        lng: Number(s.lng.toFixed(6)),
        progress: Number(t.toFixed(2)),
      });

      if (step % PERSIST_EVERY === 0 || step >= MOVE_STEPS) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { riderLat: s.lat, riderLng: s.lng },
        });
      }

      if (step >= MOVE_STEPS) {
        await this.deliver(orderId);
        return;
      }
      s.timers.push(setTimeout(() => void tick(), STEP_MS));
    };
    state.timers.push(setTimeout(() => void tick(), STEP_MS));
  }

  private async deliver(orderId: string) {
    const state = this.sims.get(orderId);
    if (!state) return;
    state.status = OrderStatus.DELIVERED;
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DELIVERED,
        riderLat: state.dest.lat,
        riderLng: state.dest.lng,
        deliveredAt: new Date(),
      },
    });
    this.emit(orderId, 'order:status', {
      orderId,
      status: OrderStatus.DELIVERED,
    });
    this.emit(orderId, 'order:delivered', { orderId });
    this.logger.debug(`Order ${orderId} delivered (simulated)`);
    this.stop(orderId);
  }

  stop(orderId: string) {
    const state = this.sims.get(orderId);
    if (!state) return;
    state.timers.forEach(clearTimeout);
    this.sims.delete(orderId);
  }
}
