import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { db } from '../db/database.js';

export const adminRouter = Router();

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

