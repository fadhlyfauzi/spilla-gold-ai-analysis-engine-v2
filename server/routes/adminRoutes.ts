import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { db } from '../db/database.js';
import { isWorkerOnline } from './mt5WorkerRoutes.js';
import { decryptMt5Password } from '../services/mt5CredentialService.js';

export const adminRouter = Router();

// In-memory set to track accounts undergoing manual MT5 provisioning on the central laptop
const processingAccounts = new Set<string>();

const JWT_SECRET = process.env.JWT_SECRET || 'spilla_gold_institutional_jwt_secret_2026';

// Middleware to verify Admin Role
async function requireAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya Role ADMIN yang diizinkan.' });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sesi telah habis.' });
  }
}

/**
 * GET /api/admin/stats
 * Get user management metrics
 */
adminRouter.get('/stats', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { status: 'ACTIVE' } });
    const pendingUsers = await prisma.user.count({ where: { status: 'PENDING' } });
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        pendingUsers,
        adminCount,
      },
    });
  } catch (error: any) {
    console.error('[Admin Stats Error]', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil statistik pengguna.' });
  }
});

/**
 * GET /api/admin/users
 * List all users from Prisma DB
 */
adminRouter.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        accountType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      users: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[Admin Get Users Error]', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil daftar pengguna.' });
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Change user role (USER / ADMIN)
 */
adminRouter.put('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role tidak valid. Pilih USER atau ADMIN.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        accountType: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      message: `Role pengguna ${updatedUser.fullName} berhasil diperbarui menjadi ${role}.`,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('[Admin Update Role Error]', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui role pengguna.' });
  }
});

/**
 * PUT /api/admin/users/:id/status
 * Change user status (ACTIVE / PENDING / SUSPENDED)
 */
adminRouter.put('/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'PENDING', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        accountType: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      message: `Status pengguna ${updatedUser.fullName} berhasil diperbarui menjadi ${status}.`,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('[Admin Update Status Error]', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui status pengguna.' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user from Prisma DB
 */
adminRouter.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if ((req as any).currentUser.id === id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }

    const deletedUser = await prisma.user.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: `Pengguna ${deletedUser.fullName} (${deletedUser.email}) berhasil dihapus.`,
    });
  } catch (error: any) {
    console.error('[Admin Delete User Error]', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus pengguna.' });
  }
});

/**
 * GET /api/admin/trader-logins
 * Get trader login activity list for Copy Trade
 */
adminRouter.get('/trader-logins', requireAdmin, async (req, res) => {
  try {
    const logins = db.getTraderLogins();
    res.json({
      success: true,
      traderLogins: logins,
    });
  } catch (error: any) {
    console.error('[Admin Get Trader Logins Error]', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data aktivitas login trader.' });
  }
});

/**
 * GET /api/admin/mt5/accounts
 * Admin endpoint: List all registered MT5 TradingAccounts with user information and derived provisioning status
 */
adminRouter.get('/mt5/accounts', requireAdmin, async (req, res) => {
  try {
    // 1. Fetch all registered trading accounts ordered by newest first
    const accounts = await prisma.tradingAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch associated users to enrich accounts with user name, email, etc.
    const userIds = Array.from(new Set(accounts.map((a) => a.userId).filter((id): id is string => Boolean(id))));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        accountType: true,
      },
    });

    const userMap = new Map<string, { fullName: string; email: string; accountType?: string | null }>();
    users.forEach((u) => {
      userMap.set(u.id, u);
    });

    // 3. Enrich and derive operational statuses
    let waitingCount = 0;
    let onlineCount = 0;
    let offlineCount = 0;
    let processingCount = 0;

    const enrichedAccounts = accounts.map((acc) => {
      const userInfo = acc.userId ? userMap.get(acc.userId) : null;
      const isOnline = isWorkerOnline(acc.lastHeartbeat);
      const isProcessing = processingAccounts.has(acc.accountNumber);
      const hasHeartbeatEver = Boolean(acc.lastHeartbeat);

      let status: 'ONLINE' | 'PROCESSING' | 'WAITING FOR MT5' | 'OFFLINE';

      if (isOnline) {
        status = 'ONLINE';
        onlineCount++;
        // If it was in processing and is now online, clean up from processing set
        if (isProcessing) {
          processingAccounts.delete(acc.accountNumber);
        }
      } else if (isProcessing) {
        status = 'PROCESSING';
        processingCount++;
      } else if (!hasHeartbeatEver && !acc.workerId) {
        status = 'WAITING FOR MT5';
        waitingCount++;
      } else {
        status = 'OFFLINE';
        offlineCount++;
      }

      const lastHeartbeatAgeSeconds = acc.lastHeartbeat
        ? Math.floor((Date.now() - new Date(acc.lastHeartbeat).getTime()) / 1000)
        : null;

      return {
        id: acc.id,
        userId: acc.userId,
        userName: userInfo?.fullName || (acc.userId ? `User (${acc.userId.slice(0, 8)})` : 'Trader Member'),
        userEmail: userInfo?.email || 'user@spillagold.com',
        userAccountType: userInfo?.accountType || acc.accountType || 'Trader Individu',
        broker: acc.broker || 'AIMS',
        accountNumber: acc.accountNumber,
        brokerServer: acc.brokerServer || 'AIMS-Live',
        accountType: acc.accountType || 'STANDARD',
        currency: acc.currency || 'USD',
        workerId: acc.workerId,
        symbol: acc.symbol || 'XAUUSD',
        executionEnabled: acc.executionEnabled,
        workerOnline: isOnline,
        lastHeartbeat: acc.lastHeartbeat ? acc.lastHeartbeat.toISOString() : null,
        lastHeartbeatAgeSeconds,
        balance: acc.balance,
        equity: acc.equity,
        freeMargin: acc.freeMargin,
        leverage: acc.leverage,
        isLive: acc.isLive,
        status,
        isProcessing,
        createdAt: acc.createdAt.toISOString(),
        updatedAt: acc.updatedAt.toISOString(),
      };
    });

    return res.json({
      success: true,
      stats: {
        total: accounts.length,
        waitingCount,
        onlineCount,
        offlineCount,
        processingCount,
      },
      accounts: enrichedAccounts,
    });
  } catch (error: any) {
    console.error('[Admin MT5 Accounts Error]', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil antrean provisioning akun MT5.' });
  }
});

/**
 * PATCH /api/admin/mt5/accounts/:accountNumber/processing
 * Admin action: Mark/unmark an account as being manually processed on central MT5 terminal
 */
adminRouter.patch('/mt5/accounts/:accountNumber/processing', requireAdmin, async (req, res) => {
  try {
    const accountNumber = String(req.params.accountNumber || '').trim();
    const { isProcessing } = req.body || {};

    if (!accountNumber) {
      return res.status(400).json({ success: false, message: 'Nomor akun MT5 wajib diisi.' });
    }

    if (isProcessing) {
      processingAccounts.add(accountNumber);
    } else {
      processingAccounts.delete(accountNumber);
    }

    return res.json({
      success: true,
      message: `Status provisioning akun ${accountNumber} berhasil diperbarui menjadi ${isProcessing ? 'PROCESSING' : 'PENDING'}.`,
      accountNumber,
      isProcessing: processingAccounts.has(accountNumber),
    });
  } catch (error: any) {
    console.error('[Admin Update Processing Status Error]', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status processing akun MT5.' });
  }
});

/**
 * POST /api/admin/mt5/accounts/:accountNumber/reveal-credential
 * Admin-only action: Decrypts and securely reveals trading password for manual MT5 login on the central laptop.
 * NEVER logs password, NEVER returns in query string or standard listings.
 */
adminRouter.post('/mt5/accounts/:accountNumber/reveal-credential', requireAdmin, async (req, res) => {
  try {
    const accountNumber = String(req.params.accountNumber || '').trim();
    if (!accountNumber) {
      return res.status(400).json({ success: false, message: 'Nomor akun MT5 wajib diisi.' });
    }

    const account = await prisma.tradingAccount.findUnique({
      where: { accountNumber },
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Akun trading MT5 tidak ditemukan.' });
    }

    const credential = await prisma.tradingAccountCredential.findUnique({
      where: { tradingAccountId: account.id },
    });

    if (!credential) {
      return res.status(404).json({
        success: false,
        code: 'CREDENTIAL_NOT_FOUND',
        message: 'Kredensial terenkripsi tidak ditemukan untuk akun ini (mungkin akun demo atau akun terdahulu).',
      });
    }

    let tradingPassword = '';
    try {
      tradingPassword = decryptMt5Password(credential.encryptedPassword, credential.iv, credential.authTag);
    } catch (decErr: any) {
      console.error('[Admin Reveal Credential Decryption Error]:', decErr?.message);
      return res.status(500).json({
        success: false,
        code: 'DECRYPTION_ERROR',
        message: 'Gagal mendekripsi kata sandi MT5. Pastikan kunci enkripsi MT5_CREDENTIAL_ENCRYPTION_KEY sesuai.',
      });
    }

    return res.json({
      success: true,
      accountNumber: account.accountNumber,
      broker: account.broker,
      brokerServer: account.brokerServer,
      tradingPassword,
    });
  } catch (error: any) {
    console.error('[Admin Reveal MT5 Credential Error]', error);
    return res.status(500).json({ success: false, message: 'Gagal membuka kredensial akun MT5.' });
  }
});

/**
 * DELETE /api/admin/mt5/accounts/:accountNumber
 * Admin action: Remove / disconnect a trading account from the system
 */
adminRouter.delete('/mt5/accounts/:accountNumber', requireAdmin, async (req, res) => {
  try {
    const accountNumber = String(req.params.accountNumber || '').trim();
    if (!accountNumber) {
      return res.status(400).json({ success: false, message: 'Nomor akun MT5 wajib diisi.' });
    }

    const account = await prisma.tradingAccount.findUnique({
      where: { accountNumber },
    });

    if (!account) {
      return res.status(404).json({ success: false, message: 'Akun trading MT5 tidak ditemukan.' });
    }

    await prisma.tradingAccountCredential.deleteMany({
      where: { tradingAccountId: account.id },
    });

    await prisma.tradingAccount.delete({
      where: { accountNumber },
    });

    processingAccounts.delete(accountNumber);

    console.log(`[ADMIN MT5 ACCOUNT REMOVED] Admin=${(req as any).currentUser?.email} Account=${accountNumber}`);

    return res.json({
      success: true,
      message: `Akun trading MT5 ${accountNumber} (${account.broker}) berhasil dihapus dari sistem.`,
    });
  } catch (error: any) {
    console.error('[Admin Delete MT5 Account Error]', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus akun trading MT5.' });
  }
});


