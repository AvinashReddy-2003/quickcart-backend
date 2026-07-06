import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CartModule } from '../cart/cart.module';
import { AddressesModule } from '../addresses/addresses.module';
import { PaymentModule } from '../payments/payment.module';

@Module({
  imports: [CartModule, AddressesModule, PaymentModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
