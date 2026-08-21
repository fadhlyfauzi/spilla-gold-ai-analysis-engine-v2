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

export interface TradingAccountRecord {
  id: string;
  userId?: string | null;
  accountNumber: string;
  brokerServer: string;
  accountType: string;
  currency: string;
  workerId?: string | null;
  symbol?: string | null;
  executionEnabled: boolean;
  workerOnline: boolean;
  lastHeartbeat?: Date | null;
  balance: number;
  equity: number;
  freeMargin: number;
  leverage: number;
  isLive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Memory fallback store for TradingAccount if Postgres is unavailable
class MemoryTradingAccountStore {
  private accounts: TradingAccountRecord[] = [];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const now = new Date();
    this.accounts = [
      {
        id: 'acc-1019008',
        userId: 'usr-trader-002',
        accountNumber: '1019008',
        brokerServer: 'AIMS-Live',
        accountType: 'STANDARD',
        currency: 'USD',
        workerId: null,
        symbol: 'XAUUSD.edge',
        executionEnabled: false,
        workerOnline: false,
        lastHeartbeat: null,
        balance: 10000.0,
        equity: 10000.0,
        freeMargin: 10000.0,
        leverage: 100,
        isLive: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'acc-mt5-demo',
        userId: 'usr-trader-002',
        accountNumber: 'MT5-DEMO-01',
        brokerServer: 'AIMS-Live',
        accountType: 'STANDARD',
        currency: 'USD',
        workerId: null,
        symbol: 'XAUUSD',
        executionEnabled: false,
        workerOnline: false,
        lastHeartbeat: null,
        balance: 10000.0,
        equity: 10000.0,
        freeMargin: 10000.0,
        leverage: 100,
        isLive: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'acc-88201923',
        userId: 'usr-trader-002',
        accountNumber: '88201923',
        brokerServer: 'AIMS-Live',
        accountType: 'PRO',
        currency: 'USD',
        workerId: null,
        symbol: 'XAUUSD',
        executionEnabled: false,
        workerOnline: false,
        lastHeartbeat: null,
        balance: 15420.0,
        equity: 15420.0,
        freeMargin: 15420.0,
        leverage: 100,
        isLive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'acc-88204811',
        userId: 'usr-admin-001',
        accountNumber: '88204811',
        brokerServer: 'AIMS-Live',
        accountType: 'INSTITUTIONAL',
        currency: 'USD',
        workerId: null,
        symbol: 'XAUUSD',
        executionEnabled: false,
        workerOnline: false,
        lastHeartbeat: null,
        balance: 24850.0,
        equity: 24850.0,
        freeMargin: 24850.0,
        leverage: 100,
        isLive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  async count(args?: { where?: any }): Promise<number> {
    if (!args?.where) return this.accounts.length;
    const { accountNumber, workerId } = args.where;
    return this.accounts.filter((a) => {
      if (accountNumber && a.accountNumber !== accountNumber) return false;
      if (workerId && a.workerId !== workerId) return false;
      return true;
    }).length;
  }

  async findUnique(args: { where: { accountNumber?: string; id?: string } }): Promise<TradingAccountRecord | null> {
    const { accountNumber, id } = args.where;
    if (accountNumber) {
      const normalized = accountNumber.trim();
      return this.accounts.find((a) => a.accountNumber === normalized) || null;
    }
    if (id) {
      return this.accounts.find((a) => a.id === id) || null;
    }
    return null;
  }

  async findFirst(args?: { where?: any }): Promise<TradingAccountRecord | null> {
    if (!args?.where) return this.accounts[0] || null;
    const { accountNumber, id, workerId } = args.where;
    return this.accounts.find((a) => {
      if (accountNumber && a.accountNumber !== accountNumber.trim()) return false;
      if (id && a.id !== id) return false;
      if (workerId && a.workerId !== workerId) return false;
      return true;
    }) || null;
  }

  async findMany(args?: { where?: any; orderBy?: any }): Promise<TradingAccountRecord[]> {
    let list = [...this.accounts];
    if (args?.where) {
      const { workerOnline, isLive } = args.where;
      list = list.filter((a) => {
        if (workerOnline !== undefined && a.workerOnline !== workerOnline) return false;
        if (isLive !== undefined && a.isLive !== isLive) return false;
        return true;
      });
    }
    return list;
  }

  async create(args: { data: any }): Promise<TradingAccountRecord> {
    const now = new Date();
    const newAcc: TradingAccountRecord = {
      id: `acc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: args.data.userId || null,
      accountNumber: String(args.data.accountNumber).trim(),
      brokerServer: args.data.brokerServer || 'AIMS-Live',
      accountType: args.data.accountType || 'STANDARD',
      currency: args.data.currency || 'USD',
      workerId: args.data.workerId || null,
      symbol: args.data.symbol || 'XAUUSD',
      executionEnabled: args.data.executionEnabled ?? false,
      workerOnline: args.data.workerOnline ?? false,
      lastHeartbeat: args.data.lastHeartbeat || null,
      balance: args.data.balance !== undefined ? Number(args.data.balance) : 10000.0,
      equity: args.data.equity !== undefined ? Number(args.data.equity) : 10000.0,
      freeMargin: args.data.freeMargin !== undefined ? Number(args.data.freeMargin) : 10000.0,
      leverage: args.data.leverage !== undefined ? Number(args.data.leverage) : 100,
      isLive: args.data.isLive !== undefined ? Boolean(args.data.isLive) : false,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.push(newAcc);
    return newAcc;
  }

  async update(args: { where: { accountNumber?: string; id?: string }; data: any }): Promise<TradingAccountRecord> {
    const idx = this.accounts.findIndex((a) => {
      if (args.where.accountNumber && a.accountNumber === args.where.accountNumber.trim()) return true;
      if (args.where.id && a.id === args.where.id) return true;
      return false;
    });
    if (idx === -1) {
      throw new Error(`TradingAccount not found for update`);
    }
    const existing = this.accounts[idx];
    const updated: TradingAccountRecord = {
      ...existing,
      ...args.data,
      updatedAt: new Date(),
    };
    this.accounts[idx] = updated;
    return updated;
  }
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
const memoryAccountStore = new MemoryTradingAccountStore();

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
    console.warn('[Prisma Init Warning] Failed to initialize Postgres adapter, falling back to Memory Stores.');
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
  tradingAccount: {
    count: async (args?: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await (realPrisma as any).tradingAccount.count(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryAccountStore.count(args);
    },
    findUnique: async (args: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await (realPrisma as any).tradingAccount.findUnique(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryAccountStore.findUnique(args);
    },
    findFirst: async (args?: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await (realPrisma as any).tradingAccount.findFirst(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryAccountStore.findFirst(args);
    },
    findMany: async (args?: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await (realPrisma as any).tradingAccount.findMany(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryAccountStore.findMany(args);
    },
    create: async (args: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await (realPrisma as any).tradingAccount.create(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryAccountStore.create(args);
    },
    update: async (args: any) => {
      if (useRealPrisma && realPrisma) {
        try { return await (realPrisma as any).tradingAccount.update(args); } catch (err) { useRealPrisma = false; }
      }
      return memoryAccountStore.update(args);
    },
  },
};

/**
 * Returns the singleton Prisma client instance (or architecture fallback)
 */
export function getPrismaClient() {
  return prisma;
}

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

