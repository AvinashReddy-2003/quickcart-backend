import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { ListRestaurantsDto } from './dto/list-restaurants.dto';
import { MenuQueryDto } from './dto/menu-query.dto';

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListRestaurantsDto) {
    const { search, cuisine, isVeg, page, limit } = query;

    const where: Prisma.RestaurantWhereInput = {
      isActive: true,
      ...(cuisine ? { cuisine: { equals: cuisine, mode: 'insensitive' } } : {}),
      ...(isVeg !== undefined ? { isVeg } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { cuisine: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.restaurant.count({ where }),
      this.prisma.restaurant.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id, isActive: true },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    return restaurant;
  }

  async getMenu(id: string, query: MenuQueryDto) {
    // Ensure the restaurant exists (and is active) before returning its menu.
    await this.findOne(id);

    const { search, category, isVeg, minPrice, maxPrice } = query;

    const price: Prisma.DecimalFilter | undefined =
      minPrice !== undefined || maxPrice !== undefined
        ? {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          }
        : undefined;

    const where: Prisma.MenuItemWhereInput = {
      restaurantId: id,
      ...(category
        ? { category: { equals: category, mode: 'insensitive' } }
        : {}),
      ...(isVeg !== undefined ? { isVeg } : {}),
      ...(price ? { price } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.menuItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
}
