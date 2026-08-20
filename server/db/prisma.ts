import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  accountType: string;
  createdAt: Date;
  updatedAt: Date;
}

// Memory fallback store if Postgres is unavailable
class MemoryUserStore {
  private users: UserRecord[] = [];

  constructor() {
    this.seedDefaults();
  }

  private async seedDefaults() {
    const adminHash = await bcrypt.hash('Admin123!', 10);
    const traderHash = await bcrypt.hash('trader123', 10);
    const now = new Date();

    this.users = [
      {
        id: 'usr-admin-001',
        fullName: 'Master Admin SPILLA',
        email: 'admin@spillagold.com',
        password: adminHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        accountType: 'Institutional Quantitative',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr-trader-002',
        fullName: 'Institutional Trader',
        email: 'trader@spillagold.com',
        password: traderHash,
        role: 'USER',
        status: 'ACTIVE',
        accountType: 'Trader Individu',
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  async count(args?: { where?: any }): Promise<number> {
    if (!args?.where) return this.users.length;
    const { status, role } = args.where;
    return this.users.filter((u) => {
      if (status && u.status !== status) return false;
      if (role && u.role !== role) return false;
      return true;
    }).length;
  }

  async findUnique(args: { where: { email?: string; id?: string } }): Promise<UserRecord | null> {
    const { email, id } = args.where;
    if (email) {
      const normalized = email.trim().toLowerCase();
      return this.users.find((u) => u.email.toLowerCase() === normalized) || null;
    }
    if (id) {
      return this.users.find((u) => u.id === id) || null;
    }
    return null;
  }

  async findMany(args?: { orderBy?: any; select?: any }): Promise<UserRecord[]> {
    let sorted = [...this.users];
    if (args?.orderBy?.createdAt === 'desc') {
      sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return sorted;
  }

  async create(args: { data: any }): Promise<UserRecord> {
    const now = new Date();
    const newUser: UserRecord = {
      id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fullName: args.data.fullName,
      email: args.data.email.trim().toLowerCase(),
      password: args.data.password,
      role: args.data.role || 'USER',
      status: args.data.status || 'ACTIVE',
      accountType: args.data.accountType || 'Trader Individu',
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(newUser);
    return newUser;
  }

  async update(args: { where: { id: string }; data: any; select?: any }): Promise<UserRecord> {
    const idx = this.users.findIndex((u) => u.id === args.where.id);
    if (idx === -1) throw new Error(`User with ID ${args.where.id} not found.`);
    const existing = this.users[idx];
    const updated: UserRecord = {
      ...existing,
      ...args.data,
      updatedAt: new Date(),
    };
    this.users[idx] = updated;
    return updated;
  }

  async delete(args: { where: { id: string } }): Promise<UserRecord> {
    const idx = this.users.findIndex((u) => u.id === args.where.id);
    if (idx === -1) throw new Error(`User with ID ${args.where.id} not found.`);
    const [removed] = this.users.splice(idx, 1);
    return removed;
  }
}

const memoryStore = new MemoryUserStore();

let realPrisma: PrismaClient | null = null;
let useRealPrisma = false;

const connectionString = process.env.DATABASE_URL;
if (connectionString && (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://'))) {
  try {
    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    realPrisma = new PrismaClient({ adapter });
    useRealPrisma = true;
  } catch (e) {
    console.warn('[Prisma Init Warning] Failed to initialize Postgres adapter, falling back to Memory User Store.');
  }
}

export const prisma: any = {
  user: {
    count: async (args?: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await realPrisma.user.count(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryStore.count(args);
    },
    findUnique: async (args: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await realPrisma.user.findUnique(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryStore.findUnique(args);
    },
    findMany: async (args?: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await realPrisma.user.findMany(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryStore.findMany(args);
    },
    create: async (args: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await realPrisma.user.create(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryStore.create(args);
    },
    update: async (args: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await realPrisma.user.update(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryStore.update(args);
    },
    delete: async (args: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await realPrisma.user.delete(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryStore.delete(args);
    },
  },
};

export async function seedDefaultUsers() {
  try {
    const count = await prisma.user.count();
    if (count === 0 && useRealPrisma && realPrisma) {
      console.log('[Prisma Seed] Seeding default admin and trader accounts into Postgres...');
      const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
      const traderPasswordHash = await bcrypt.hash('trader123', 10);

      await realPrisma.user.create({
        data: {
          fullName: 'Master Admin SPILLA',
          email: 'admin@spillagold.com',
          password: adminPasswordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
          accountType: 'Institutional Quantitative',
        },
      });

      await realPrisma.user.create({
        data: {
          fullName: 'Institutional Trader',
          email: 'trader@spillagold.com',
          password: traderPasswordHash,
          role: 'USER',
          status: 'ACTIVE',
          accountType: 'Trader Individu',
        },
      });
      console.log('[Prisma Seed] Default accounts seeded.');
    }
  } catch (err) {
    console.warn('[Prisma Seed Note] Database seed skipped, memory user store active.');
  }
}

seedDefaultUsers();

