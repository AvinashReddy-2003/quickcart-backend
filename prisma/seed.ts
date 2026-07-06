import { PrismaClient, Role } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  // A known admin so the admin-only endpoint (GET /api/users) can be tested.
  // Log in as this phone via the normal OTP flow to receive an ADMIN token.
  const admin = await prisma.user.upsert({
    where: { phone: '+919999999999' },
    update: { role: Role.ADMIN },
    create: {
      phone: '+919999999999',
      name: 'QuickCart Admin',
      role: Role.ADMIN,
    },
  });

  console.log(`Seeded admin user: ${admin.phone} (id: ${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
