import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { ListStoresDto } from './dto/list-stores.dto';
import { ProductQueryDto } from './dto/product-query.dto';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListStoresDto) {
    const { vertical, search, cuisine, isVeg, page, limit } = query;

    const where: Prisma.StoreWhereInput = {
      isActive: true,
      ...(vertical ? { vertical } : {}),
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
      this.prisma.store.count({ where }),
      this.prisma.store.findMany({
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
    const store = await this.prisma.store.findFirst({
      where: { id, isActive: true },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  async getProducts(id: string, query: ProductQueryDto) {
    // Ensure the store exists (and is active) before returning its products.
    await this.findOne(id);

    const { search, category, isVeg, minPrice, maxPrice } = query;

    const price: Prisma.DecimalFilter | undefined =
      minPrice !== undefined || maxPrice !== undefined
        ? {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          }
        : undefined;

    const where: Prisma.ProductWhereInput = {
      storeId: id,
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

    return this.prisma.product.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
}
