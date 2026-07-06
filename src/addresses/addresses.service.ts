import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  // MVP serviceability: Hyderabad/Telangana pincodes (5xxxxx).
  static isServiceable(pincode: string): boolean {
    return /^5\d{5}$/.test(pincode);
  }

  async create(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.create({
      data: { ...dto, userId },
    });
  }

  list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.address.delete({ where: { id } });
    return { message: 'Address removed' };
  }
}
