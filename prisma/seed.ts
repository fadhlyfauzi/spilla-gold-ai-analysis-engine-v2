import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('[Prisma Seed] Initializing database seeding...');

  // Ensure Admin account exists
  const adminEmail = 'admin@spillagold.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        fullName: 'Master Admin SPILLA',
        email: adminEmail,
        password: adminPasswordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        accountType: 'Institutional Quantitative Administrator',
      },
    });
    console.log(`[Prisma Seed] Created Admin user: ${adminEmail} / Admin123!`);
  } else {
    // Update password to Admin123! to guarantee login with Admin123!
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        password: adminPasswordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    console.log(`[Prisma Seed] Updated existing Admin password for: ${adminEmail} to Admin123!`);
  }

  // Ensure Initial Trader account exists
  const traderEmail = 'trader@spillagold.com';
  const existingTrader = await prisma.user.findUnique({
    where: { email: traderEmail },
  });

  if (!existingTrader) {
    const traderPasswordHash = await bcrypt.hash('trader123', 10);
    await prisma.user.create({
      data: {
        fullName: 'Institutional Trader',
        email: traderEmail,
        password: traderPasswordHash,
        role: 'USER',
        status: 'ACTIVE',
        accountType: 'Trader Individu',
      },
    });
    console.log(`[Prisma Seed] Created Trader user: ${traderEmail} / trader123`);
  } else {
    const traderPasswordHash = await bcrypt.hash('trader123', 10);
    await prisma.user.update({
      where: { email: traderEmail },
      data: {
        password: traderPasswordHash,
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    console.log(`[Prisma Seed] Updated Trader user: ${traderEmail} / trader123`);
  }

  console.log('[Prisma Seed] Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Prisma Seed Error]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
