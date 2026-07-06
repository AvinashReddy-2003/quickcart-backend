import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt.strategy';
import { SimulationService, room } from './simulation.service';

interface SubscribePayload {
  token: string;
  orderId: string;
}

@WebSocketGateway({ namespace: '/tracking', cors: { origin: '*' } })
export class TrackingGateway implements OnGatewayInit {
  private readonly logger = new Logger(TrackingGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly simulation: SimulationService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.simulation.setServer(server);
  }

  /** Client: socket.emit('subscribe', { token, orderId }) */
  @SubscribeMessage('subscribe')
  async onSubscribe(client: Socket, payload: SubscribePayload) {
    const { token, orderId } = payload ?? {};
    if (!token || !orderId) {
      client.emit('error', { message: 'token and orderId are required' });
      return;
    }

    let userId: string;
    try {
      const decoded = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      userId = decoded.sub;
    } catch {
      client.emit('error', { message: 'Invalid token' });
      return;
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: userId },
    });
    if (!order) {
      client.emit('error', { message: 'Order not found' });
      return;
    }

    await client.join(room(orderId));

    // Send the current snapshot immediately (live sim state, else DB).
    const live = this.simulation.getState(orderId);
    if (live) {
      client.emit('snapshot', {
        orderId,
        status: live.status,
        rider: live.rider,
        lat: live.lat,
        lng: live.lng,
      });
    } else {
      client.emit('snapshot', {
        orderId,
        status: order.status,
        rider: order.riderName
          ? {
              name: order.riderName,
              phone: order.riderPhone,
              vehicle: order.riderVehicle,
            }
          : null,
        lat: order.riderLat,
        lng: order.riderLng,
      });
    }
  }
}
