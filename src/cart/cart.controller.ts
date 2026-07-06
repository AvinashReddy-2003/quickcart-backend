import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddItemDto } from './dto/add-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Query('coupon') coupon?: string) {
    return this.cart.getDetailed(user.id, coupon);
  }

  @Post('items')
  add(@CurrentUser() user: AuthUser, @Body() dto: AddItemDto) {
    return this.cart.add(user.id, dto.productId, dto.quantity);
  }

  @Patch('items/:productId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.cart.updateItem(user.id, productId, dto.quantity);
  }

  @Delete('items/:productId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.cart.removeItem(user.id, productId);
  }

  @Delete()
  async clear(@CurrentUser() user: AuthUser) {
    await this.cart.clear(user.id);
    return { message: 'Cart cleared' };
  }
}
