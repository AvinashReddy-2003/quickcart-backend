import { PrismaClient, Role, Vertical } from '../generated/prisma';

const prisma = new PrismaClient();

// Fixed IDs so seeding is idempotent (re-running updates instead of duplicating).
const IDS = {
  paradise: '11111111-1111-1111-1111-111111111111',
  chutneys: '22222222-2222-2222-2222-222222222222',
  pizza: '33333333-3333-3333-3333-333333333333',
  freshmart: '44444444-4444-4444-4444-444444444444',
  techbazaar: '55555555-5555-5555-5555-555555555555',
};

type SeedProduct = {
  name: string;
  description: string;
  price: number;
  category: string;
  isVeg?: boolean | null;
};

async function seedAdmin() {
  const admin = await prisma.user.upsert({
    where: { phone: '+919999999999' },
    update: { role: Role.ADMIN },
    create: { phone: '+919999999999', name: 'QuickCart Admin', role: Role.ADMIN },
  });
  console.log(`Admin: ${admin.phone} (${admin.id})`);
}

async function seedStore(
  id: string,
  store: {
    name: string;
    vertical: Vertical;
    cuisine?: string;
    isVeg?: boolean;
    address: string;
    description: string;
    products: SeedProduct[];
  },
) {
  await prisma.store.upsert({
    where: { id },
    update: {
      name: store.name,
      vertical: store.vertical,
      cuisine: store.cuisine,
      isVeg: store.isVeg ?? false,
      address: store.address,
      description: store.description,
    },
    create: {
      id,
      name: store.name,
      vertical: store.vertical,
      cuisine: store.cuisine,
      isVeg: store.isVeg ?? false,
      address: store.address,
      description: store.description,
    },
  });

  await prisma.product.deleteMany({ where: { storeId: id } });
  await prisma.product.createMany({
    data: store.products.map((p) => ({
      storeId: id,
      name: p.name,
      description: p.description,
      price: p.price,
      category: p.category,
      isVeg: p.isVeg ?? null,
    })),
  });
  console.log(`Store [${store.vertical}]: ${store.name} (${store.products.length} products)`);
}

async function main() {
  await seedAdmin();

  // ---- FOOD (Zomato-style) ----
  await seedStore(IDS.paradise, {
    name: 'Paradise Biryani',
    vertical: Vertical.FOOD,
    cuisine: 'Hyderabadi',
    isVeg: false,
    address: 'Secunderabad, Hyderabad',
    description: 'Hyderabadi • Veg & non-veg',
    products: [
      { name: 'Chicken Dum Biryani', description: 'Signature Hyderabadi dum biryani', price: 320, category: 'Biryani', isVeg: false },
      { name: 'Mutton Biryani', description: 'Tender mutton, aromatic rice', price: 420, category: 'Biryani', isVeg: false },
      { name: 'Veg Biryani', description: 'Mixed vegetables and basmati', price: 240, category: 'Biryani', isVeg: true },
      { name: 'Chicken 65', description: 'Spicy fried chicken starter', price: 260, category: 'Starters', isVeg: false },
      { name: 'Gulab Jamun', description: 'Two pieces, warm', price: 90, category: 'Desserts', isVeg: true },
    ],
  });

  await seedStore(IDS.chutneys, {
    name: 'Chutneys',
    vertical: Vertical.FOOD,
    cuisine: 'South Indian',
    isVeg: true,
    address: 'Banjara Hills, Hyderabad',
    description: 'South Indian • Pure veg',
    products: [
      { name: 'Masala Dosa', description: 'Crispy dosa with potato masala', price: 160, category: 'Tiffins', isVeg: true },
      { name: 'Idli (2 pcs)', description: 'Steamed rice cakes with chutney', price: 90, category: 'Tiffins', isVeg: true },
      { name: 'Ghee Pongal', description: 'Comforting rice and lentil pongal', price: 130, category: 'Tiffins', isVeg: true },
      { name: 'Filter Coffee', description: 'Authentic South Indian filter coffee', price: 60, category: 'Beverages', isVeg: true },
    ],
  });

  await seedStore(IDS.pizza, {
    name: 'Pizza Corner',
    vertical: Vertical.FOOD,
    cuisine: 'Italian',
    isVeg: false,
    address: 'Gachibowli, Hyderabad',
    description: 'Italian • Veg & non-veg',
    products: [
      { name: 'Margherita Pizza', description: 'Classic cheese and tomato', price: 250, category: 'Pizza', isVeg: true },
      { name: 'Chicken Pepperoni Pizza', description: 'Loaded pepperoni', price: 420, category: 'Pizza', isVeg: false },
      { name: 'Garlic Bread', description: 'Cheesy garlic bread sticks', price: 150, category: 'Sides', isVeg: true },
      { name: 'Choco Lava Cake', description: 'Molten chocolate centre', price: 120, category: 'Desserts', isVeg: true },
    ],
  });

  // ---- GROCERY (quick-commerce) ----
  await seedStore(IDS.freshmart, {
    name: 'FreshMart Grocery',
    vertical: Vertical.GROCERY,
    address: 'Kondapur, Hyderabad',
    description: 'Daily essentials delivered in minutes',
    products: [
      { name: 'Amul Milk 1L', description: 'Full-cream toned milk', price: 66, category: 'Dairy' },
      { name: 'Brown Bread', description: 'Whole-wheat loaf, 400g', price: 45, category: 'Bakery' },
      { name: 'Farm Eggs (6)', description: 'Half-dozen fresh eggs', price: 54, category: 'Dairy' },
      { name: 'Bananas (1 dozen)', description: 'Ripe robusta bananas', price: 60, category: 'Fruits & Veg' },
      { name: 'Tomatoes 1kg', description: 'Fresh red tomatoes', price: 40, category: 'Fruits & Veg' },
    ],
  });

  // ---- SHOP (Amazon-style e-commerce) ----
  await seedStore(IDS.techbazaar, {
    name: 'TechBazaar',
    vertical: Vertical.SHOP,
    address: 'Online • Ships across Hyderabad',
    description: 'Electronics and gadgets at great prices',
    products: [
      { name: 'Wireless Earbuds', description: 'Bluetooth 5.3, 30h battery', price: 1999, category: 'Audio' },
      { name: 'USB-C Fast Charger 33W', description: 'Compact fast charging adapter', price: 799, category: 'Accessories' },
      { name: 'Power Bank 20000mAh', description: 'Dual-port, fast charge', price: 1499, category: 'Accessories' },
      { name: 'Wireless Mouse', description: 'Silent-click ergonomic mouse', price: 649, category: 'Computer Peripherals' },
      { name: 'Mechanical Keyboard', description: 'Hot-swappable, RGB backlit', price: 3499, category: 'Computer Peripherals' },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
