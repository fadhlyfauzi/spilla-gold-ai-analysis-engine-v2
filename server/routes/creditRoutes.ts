import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { creditService } from '../services/creditService.js';

export const creditRouter = Router();
export const adminCreditRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'spilla_gold_institutional_jwt_secret_2026';

// Middleware to extract Authenticated User
async function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email?: string; role?: string };

    let user: any = null;
    try {
      user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    } catch {
      // Memory fallback for demo credentials
    }

    if (!user) {
      if (decoded.userId === 'usr-admin-001') {
        user = { id: 'usr-admin-001', fullName: 'Master Admin SPILLA', email: 'admin@spillagold.com', role: 'ADMIN', status: 'ACTIVE' };
      } else if (decoded.userId === 'usr-trader-002') {
        user = { id: 'usr-trader-002', fullName: 'Institutional Trader', email: 'trader@spillagold.com', role: 'USER', status: 'ACTIVE' };
      } else {
        user = { id: decoded.userId, fullName: 'Trader Member', email: decoded.email || 'user@spillagold.com', role: decoded.role || 'USER', status: 'ACTIVE' };
      }
    }

    req.currentUser = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Sesi login telah habis. Silakan login kembali.' });
  }
}

// Middleware to verify Admin Role
async function requireAdmin(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    let user: any = null;
    try {
      user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    } catch {
      // Fallback
    }

    if (!user && decoded.userId === 'usr-admin-001') {
      user = { id: 'usr-admin-001', fullName: 'Master Admin SPILLA', email: 'admin@spillagold.com', role: 'ADMIN', status: 'ACTIVE' };
    }

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya Role ADMIN yang diizinkan.' });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sesi telah habis.' });
  }
}

// ==========================================
// USER CREDIT ENDPOINTS (/api/credit/*)
// ==========================================

/**
 * GET /api/credit/wallet
 * Returns current user wallet, balance, and available analysis
 */
creditRouter.get('/wallet', requireAuth, async (req: any, res) => {
  try {
    const userId = req.currentUser.id;
    const wallet = await creditService.getWallet(userId);
    const availableAnalysis = Math.floor(wallet.creditBalance / 100);
    const paymentSettings = creditService.getPaymentSettings();

    res.json({
      success: true,
      wallet,
      creditBalance: wallet.creditBalance,
      availableAnalysis,
      equivalentIdr: wallet.creditBalance, // 1 Credit = Rp1
      costPerAnalysis: 100,
      paymentSettings,
    });
  } catch (err: any) {
    console.error('[Credit Routes] Error get wallet:', err);
    res.status(500).json({ success: false, message: err.message || 'Gagal mengambil informasi wallet.' });
  }
});

/**
 * GET /api/credit/transactions
 * Returns user credit transaction ledger
 */
creditRouter.get('/transactions', requireAuth, async (req: any, res) => {
  try {
    const userId = req.currentUser.id;
    const txs = creditService.getCreditTransactions({ userId });
    res.json({
      success: true,
      transactions: txs,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/credit/topup/request
 * Creates a top up request with manual bank transfer
 */
creditRouter.post('/topup/request', requireAuth, async (req: any, res) => {
  try {
    const userId = req.currentUser.id;
    const { amountIdr, referenceNotes } = req.body || {};

    const amount = Number(amountIdr);
    if (!amount || isNaN(amount) || amount < 1000) {
      return res.status(400).json({ success: false, message: 'Nominal Top Up minimal Rp1.000 (1.000 Credit).' });
    }

    const topup = await creditService.createTopUpRequest(userId, amount, referenceNotes);
    res.json({
      success: true,
      message: 'Permintaan Top Up berhasil dibuat. Silakan selesaikan transfer bank sesuai petunjuk.',
      topup,
    });
  } catch (err: any) {
    console.error('[Credit Routes] Topup request error:', err);
    res.status(400).json({ success: false, message: err.message || 'Gagal membuat permintaan Top Up.' });
  }
});

/**
 * GET /api/credit/topup/history
 * Returns user's topup history
 */
creditRouter.get('/topup/history', requireAuth, async (req: any, res) => {
  try {
    const userId = req.currentUser.id;
    const history = creditService.getTopUpRequests({ userId });
    res.json({
      success: true,
      topups: history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/credit/payment-settings
 * Returns public bank payment info
 */
creditRouter.get('/payment-settings', (_req, res) => {
  try {
    const settings = creditService.getPaymentSettings();
    res.json({
      success: true,
      paymentSettings: settings,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/credit/analysis-history
 * Returns user's AI analysis history
 */
creditRouter.get('/analysis-history', requireAuth, async (req: any, res) => {
  try {
    const userId = req.currentUser.id;
    const history = creditService.getAiAnalysisHistory({ userId });
    res.json({
      success: true,
      analysisHistory: history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// ADMIN CREDIT ENDPOINTS (/api/admin/credit/*)
// ==========================================

/**
 * GET /api/admin/credit/stats
 */
adminCreditRouter.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const stats = creditService.getAdminCreditStats();
    res.json({
      success: true,
      stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/credit/wallets
 */
adminCreditRouter.get('/wallets', requireAdmin, async (req, res) => {
  try {
    const search = req.query.search as string;
    const wallets = await creditService.getAllUserWalletsWithUsers(search);
    res.json({
      success: true,
      wallets,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/credit/topups
 */
adminCreditRouter.get('/topups', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status as string;
    const search = req.query.search as string;
    const topups = creditService.getTopUpRequests({ status, search });
    res.json({
      success: true,
      topups,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/credit/topup/:id/confirm
 */
adminCreditRouter.post('/topup/:id/confirm', requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body || {};
    const adminUser = req.currentUser;

    const result = await creditService.confirmTopUpRequest(id, adminUser.id, adminUser.fullName, adminNotes);
    res.json({
      success: true,
      message: `Top Up ${id} berhasil dikonfirmasi. ${result.topup.creditRequested.toLocaleString('id-ID')} Credit telah ditambahkan ke wallet pengguna.`,
      result,
    });
  } catch (err: any) {
    console.error('[Admin Credit Confirm Error]', err);
    res.status(400).json({ success: false, message: err.message || 'Gagal mengonfirmasi pembayaran Top Up.' });
  }
});

/**
 * POST /api/admin/credit/topup/:id/reject
 */
adminCreditRouter.post('/topup/:id/reject', requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body || {};
    const adminUser = req.currentUser;

    if (!adminNotes || adminNotes.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Alasan penolakan (Admin Notes) wajib diisi.' });
    }

    const topup = await creditService.rejectTopUpRequest(id, adminUser.id, adminUser.fullName, adminNotes);
    res.json({
      success: true,
      message: `Top Up ${id} telah ditolak.`,
      topup,
    });
  } catch (err: any) {
    console.error('[Admin Credit Reject Error]', err);
    res.status(400).json({ success: false, message: err.message || 'Gagal menolak Top Up.' });
  }
});

/**
 * POST /api/admin/credit/adjust
 */
adminCreditRouter.post('/adjust', requireAdmin, async (req: any, res) => {
  try {
    const { targetUserId, type, amount, reason } = req.body || {};
    const adminUser = req.currentUser;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'Target User ID wajib dipilih.' });
    }
    if (!type || !['ADD', 'DEDUCT'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipe penyesuaian harus ADD atau DEDUCT.' });
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal penyesuaian harus lebih dari 0.' });
    }

    const result = await creditService.adjustCredit(adminUser.id, adminUser.fullName, targetUserId, {
      type,
      amount: numAmount,
      reason,
    });

    res.json({
      success: true,
      message: `Penyesuaian saldo berhasil: ${type === 'ADD' ? '+' : '-'}${numAmount.toLocaleString('id-ID')} Credit. Saldo baru: ${result.wallet.creditBalance.toLocaleString('id-ID')} Credit.`,
      result,
    });
  } catch (err: any) {
    console.error('[Admin Credit Adjust Error]', err);
    res.status(400).json({ success: false, message: err.message || 'Gagal melakukan penyesuaian saldo.' });
  }
});

/**
 * GET /api/admin/credit/transactions
 */
adminCreditRouter.get('/transactions', requireAdmin, async (req, res) => {
  try {
    const type = req.query.type as string;
    const search = req.query.search as string;
    const transactions = creditService.getCreditTransactions({ type, search });
    res.json({
      success: true,
      transactions,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/credit/payment-settings
 */
adminCreditRouter.get('/payment-settings', requireAdmin, async (_req, res) => {
  try {
    const settings = creditService.getPaymentSettings();
    res.json({
      success: true,
      paymentSettings: settings,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/credit/payment-settings
 */
adminCreditRouter.post('/payment-settings', requireAdmin, async (req, res) => {
  try {
    const { bankName, accountNumber, accountName, instructions, isActive } = req.body || {};
    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({ success: false, message: 'Bank Name, Account Number, dan Account Name wajib diisi.' });
    }

    const updated = creditService.updatePaymentSettings({
      bankName,
      accountNumber,
      accountName,
      instructions: instructions || '',
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.json({
      success: true,
      message: 'Pengaturan rekening pembayaran transfer bank berhasil disimpan.',
      paymentSettings: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
