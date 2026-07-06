import { PrismaClient, Role } from '../generated/prisma';

const prisma = new PrismaClient();

// Fixed IDs so seeding is idempotent (re-running updates instead of duplicating).
const R1 = '11111111-1111-1111-1111-111111111111';
const R2 = '22222222-2222-2222-2222-222222222222';
const R3 = '33333333-3333-3333-3333-333333333333';

async function seedAdmin() {
  const admin = await prisma.user.upsert({
    where: { phone: '+919999999999' },
    update: { role: Role.ADMIN },
    create: { phone: '+919999999999', name: 'QuickCart Admin', role: Role.ADMIN },
  });
  console.log(`Admin: ${admin.phone} (${admin.id})`);
}

async function seedRestaurant(
  id: string,
  data: {
    name: string;
    cuisine: string;
    isVeg: boolean;
    address: string;
    items: {
      name: string;
      description: string;
      price: number;
      isVeg: boolean;
      category: string;
    }[];
  },
) {
  await prisma.restaurant.upsert({
    where: { id },
    update: {
      name: data.name,
      cuisine: data.cuisine,
      isVeg: data.isVeg,
      address: data.address,
    },
    create: {
      id,
      name: data.name,
      cuisine: data.cuisine,
      isVeg: data.isVeg,
      address: data.address,
      description: `${data.cuisine} • ${data.isVeg ? 'Pure veg' : 'Veg & non-veg'}`,
    },
  });

  // Reset menu for this restaurant so seeding stays deterministic.
  await prisma.menuItem.deleteMany({ where: { restaurantId: id } });
  await prisma.menuItem.createMany({
    data: data.items.map((item) => ({ ...item, restaurantId: id })),
  });
  console.log(`Restaurant: ${data.name} (${data.items.length} items)`);
}

async function main() {
  await seedAdmin();

  await seedRestaurant(R1, {
    name: 'Paradise Biryani',
    cuisine: 'Hyderabadi',
    isVeg: false,
    address: 'Secunderabad, Hyderabad',
    items: [
      { name: 'Chicken Dum Biryani', description: 'Signature Hyderabadi dum biryani', price: 320, isVeg: false, category: 'Biryani' },
      { name: 'Mutton Biryani', description: 'Tender mutton, aromatic rice', price: 420, isVeg: false, category: 'Biryani' },
      { name: 'Veg Biryani', description: 'Mixed vegetables and basmati', price: 240, isVeg: true, category: 'Biryani' },
      { name: 'Chicken 65', description: 'Spicy fried chicken starter', price: 260, isVeg: false, category: 'Starters' },
      { name: 'Gulab Jamun', description: 'Two pieces, warm', price: 90, isVeg: true, category: 'Desserts' },
    ],
  });

  await seedRestaurant(R2, {
    name: 'Chutneys',
    cuisine: 'South Indian',
    isVeg: true,
    address: 'Banjara Hills, Hyderabad',
    items: [
      { name: 'Masala Dosa', description: 'Crispy dosa with potato masala', price: 160, isVeg: true, category: 'Tiffins' },
      { name: 'Idli (2 pcs)', description: 'Steamed rice cakes with chutney', price: 90, isVeg: true, category: 'Tiffins' },
      { name: 'Ghee Pongal', description: 'Comforting rice and lentil pongal', price: 130, isVeg: true, category: 'Tiffins' },
      { name: 'Filter Coffee', description: 'Authentic South Indian filter coffee', price: 60, isVeg: true, category: 'Beverages' },
    ],
  });

  await seedRestaurant(R3, {
    name: 'Pizza Corner',
    cuisine: 'Italian',
    isVeg: false,
    address: 'Gachibowli, Hyderabad',
    items: [
      { name: 'Margherita Pizza', description: 'Classic cheese and tomato', price: 250, isVeg: true, category: 'Pizza' },
      { name: 'Chicken Pepperoni Pizza', description: 'Loaded pepperoni', price: 420, isVeg: false, category: 'Pizza' },
      { name: 'Garlic Bread', description: 'Cheesy garlic bread sticks', price: 150, isVeg: true, category: 'Sides' },
      { name: 'Choco Lava Cake', description: 'Molten chocolate centre', price: 120, isVeg: true, category: 'Desserts' },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
