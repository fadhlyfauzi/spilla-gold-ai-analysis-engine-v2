import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { getPrismaClient } from '../db/prisma.js';

export const mt5WorkerRouter = Router();
const prisma = getPrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'spilla_gold_institutional_jwt_secret_2026';

/**
 * Authentication Middleware for MT5 User Operations
 */
export async function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Akses ditolak. Silakan login terlebih dahulu.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email?: string; role?: string };

    let user: any = null;
    try {
      user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    } catch {
      // Memory fallback
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
    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Sesi login telah habis. Silakan login kembali.',
    });
  }
}

/**
 * Helper to determine real worker connection status based on heartbeat freshness.
 * ONLINE = lastHeartbeat exists AND current server time - lastHeartbeat <= 30 seconds
 */
export function isWorkerOnline(lastHeartbeat: Date | string | number | null | undefined): boolean {
  if (!lastHeartbeat) return false;
  const heartbeatTime = new Date(lastHeartbeat).getTime();
  if (isNaN(heartbeatTime)) return false;
  const elapsedMs = Date.now() - heartbeatTime;
  return elapsedMs >= 0 && elapsedMs <= 30000;
}

/**
 * POST /api/mt5/accounts
 * Phase 2: Connect / Register Trading Account
 * Authenticated user registers their MT5 account metadata (broker, accountNumber, server).
 * Safe defaults applied: executionEnabled = false, workerOnline = false, balance = 0, etc.
 * The website NEVER asks for or stores MT5 passwords.
 */
mt5WorkerRouter.post('/accounts', requireAuth, async (req: any, res: any) => {
  try {
    const { broker, accountNumber, brokerServer } = req.body || {};

    // 1. Validate Account Number
    if (!accountNumber || (typeof accountNumber !== 'string' && typeof accountNumber !== 'number')) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PARAMETERS',
        message: 'accountNumber is required and must be specified',
      });
    }

    const trimmedAccountNumber = String(accountNumber).trim();
    if (!trimmedAccountNumber) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PARAMETERS',
        message: 'accountNumber cannot be empty',
      });
    }

    const trimmedBroker = broker && typeof broker === 'string' && broker.trim() ? broker.trim() : 'AIMS';
    const trimmedBrokerServer = brokerServer && typeof brokerServer === 'string' && brokerServer.trim() ? brokerServer.trim() : 'AIMS-Live';

    // 2. Duplicate Account Protection
    const existingAccount = await prisma.tradingAccount.findUnique({
      where: { accountNumber: trimmedAccountNumber },
    });

    if (existingAccount) {
      return res.status(409).json({
        success: false,
        code: 'ACCOUNT_ALREADY_REGISTERED',
        message: 'Trading account is already registered',
      });
    }

    // 3. User Ownership: Use authenticated user's ID
    const userId = req.currentUser?.id || 'usr-trader-002';

    // 4. Create TradingAccount with Safe Defaults
    // User-controlled input CANNOT set workerId, workerOnline, lastHeartbeat, or executionEnabled
    const newAccount = await prisma.tradingAccount.create({
      data: {
        userId,
        accountNumber: trimmedAccountNumber,
        broker: trimmedBroker,
        brokerServer: trimmedBrokerServer,
        accountType: 'STANDARD',
        currency: 'USD',
        workerId: null,
        symbol: 'XAUUSD',
        executionEnabled: false,
        workerOnline: false,
        lastHeartbeat: null,
        balance: 0,
        equity: 0,
        freeMargin: 0,
        leverage: 0,
        isLive: false,
      },
    });

    console.log(
      `[MT5 ACCOUNT CONNECTED] User=${userId} Account=${trimmedAccountNumber} Broker=${trimmedBroker} Server=${trimmedBrokerServer}`
    );

    return res.status(201).json({
      success: true,
      code: 'ACCOUNT_REGISTERED',
      message: 'Trading account registered successfully. Awaiting MT5 EA heartbeat.',
      account: {
        id: newAccount.id,
        accountNumber: newAccount.accountNumber,
        broker: newAccount.broker,
        brokerServer: newAccount.brokerServer,
        workerId: newAccount.workerId,
        workerOnline: false,
        executionEnabled: false,
        lastHeartbeat: null,
        balance: newAccount.balance,
        equity: newAccount.equity,
        freeMargin: newAccount.freeMargin,
        leverage: newAccount.leverage,
        isLive: newAccount.isLive,
      },
    });
  } catch (error: any) {
    console.error('[MT5 Account Registration Error]:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: error?.message || 'Failed to register trading account',
    });
  }
});

/**
 * GET /api/mt5/accounts
 * Returns trading accounts for the current user with dynamic workerOnline status.
 */
mt5WorkerRouter.get('/accounts', requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.currentUser?.id;
    const whereClause: any = {};
    if (userId && req.currentUser?.role !== 'ADMIN') {
      whereClause.userId = userId;
    }

    const accounts = await prisma.tradingAccount.findMany({
      where: whereClause,
    });

    const formatted = accounts.map((acc: any) => ({
      ...acc,
      workerOnline: isWorkerOnline(acc.lastHeartbeat),
      lastHeartbeatAgeSeconds: acc.lastHeartbeat
        ? Math.floor((Date.now() - new Date(acc.lastHeartbeat).getTime()) / 1000)
        : null,
    }));

    return res.json({
      success: true,
      count: formatted.length,
      accounts: formatted,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to fetch accounts' });
  }
});

/**
 * DELETE /api/mt5/accounts/:accountNumber
 * Allows user to disconnect / remove a registered trading account.
 */
mt5WorkerRouter.delete('/accounts/:accountNumber', requireAuth, async (req: any, res: any) => {
  try {
    const accountNumber = String(req.params.accountNumber || '').trim();
    if (!accountNumber) {
      return res.status(400).json({ success: false, message: 'Account number is required' });
    }

    const account = await prisma.tradingAccount.findUnique({
      where: { accountNumber },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        code: 'TRADING_ACCOUNT_NOT_FOUND',
        message: 'Trading account not found',
      });
    }

    // Ownership check (non-admin can only delete their own accounts)
    if (account.userId && account.userId !== req.currentUser?.id && req.currentUser?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You are not authorized to disconnect this account',
      });
    }

    await prisma.tradingAccount.delete({
      where: { accountNumber },
    });

    console.log(`[MT5 ACCOUNT DISCONNECTED] User=${req.currentUser?.id} Account=${accountNumber}`);

    return res.json({
      success: true,
      code: 'ACCOUNT_DISCONNECTED',
      message: 'Trading account disconnected successfully',
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to disconnect account' });
  }
});

/**
 * POST /api/mt5/heartbeat
 * Heartbeat endpoint periodically called by SPILLA MT5 Executor EA.
 * Purely for worker/account status tracking. Never executes trades or enables execution.
 */
mt5WorkerRouter.post('/heartbeat', async (req, res) => {
  try {
    const {
      workerId,
      accountNumber,
      brokerServer,
      symbol,
      balance,
      equity,
      freeMargin,
      leverage,
      isLive,
    } = req.body || {};

    // 1. Validate required parameters
    if (!workerId || typeof workerId !== 'string' || !workerId.trim()) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PARAMETERS',
        message: 'workerId is required and must be a non-empty string',
      });
    }

    if (!accountNumber || (typeof accountNumber !== 'string' && typeof accountNumber !== 'number')) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PARAMETERS',
        message: 'accountNumber is required',
      });
    }

    const trimmedWorkerId = String(workerId).trim();
    const trimmedAccountNumber = String(accountNumber).trim();

    if (!trimmedAccountNumber) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_PARAMETERS',
        message: 'accountNumber cannot be empty',
      });
    }

    // 2. Lookup TradingAccount in database
    const account = await prisma.tradingAccount.findUnique({
      where: { accountNumber: trimmedAccountNumber },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        code: 'TRADING_ACCOUNT_NOT_FOUND',
        message: 'Trading account is not registered',
      });
    }

    // 3. Worker Ownership Security Check
    // If account already has a worker assigned and it's different from the heartbeat worker, reject
    if (account.workerId && account.workerId.trim() !== trimmedWorkerId) {
      return res.status(403).json({
        success: false,
        code: 'WORKER_MISMATCH',
        message: 'This trading account is assigned to another worker',
      });
    }

    // 4. Prepare update data for valid heartbeat
    const serverNow = new Date();
    const updateData: any = {
      workerId: trimmedWorkerId,
      workerOnline: true,
      lastHeartbeat: serverNow,
    };

    if (brokerServer && typeof brokerServer === 'string' && brokerServer.trim()) {
      updateData.brokerServer = brokerServer.trim();
    }

    if (symbol && typeof symbol === 'string' && symbol.trim()) {
      updateData.symbol = symbol.trim();
    }

    if (balance !== undefined && typeof balance === 'number' && !isNaN(balance)) {
      updateData.balance = balance;
    }

    if (equity !== undefined && typeof equity === 'number' && !isNaN(equity)) {
      updateData.equity = equity;
    }

    if (freeMargin !== undefined && typeof freeMargin === 'number' && !isNaN(freeMargin)) {
      updateData.freeMargin = freeMargin;
    }

    if (leverage !== undefined && typeof leverage === 'number' && !isNaN(leverage)) {
      updateData.leverage = Math.round(leverage);
    }

    if (isLive !== undefined && typeof isLive === 'boolean') {
      updateData.isLive = isLive;
    }

    // ExecutionEnabled is strictly protected: heartbeat never changes executionEnabled
    // Update account in database
    const updatedAccount = await prisma.tradingAccount.update({
      where: { accountNumber: trimmedAccountNumber },
      data: updateData,
    });

    const timestampIso = updatedAccount.lastHeartbeat instanceof Date
      ? updatedAccount.lastHeartbeat.toISOString()
      : serverNow.toISOString();

    console.log(
      `[MT5 HEARTBEAT] Worker=${trimmedWorkerId} Account=${trimmedAccountNumber} Server=${updatedAccount.brokerServer} Symbol=${updatedAccount.symbol || 'N/A'} Bal=$${updatedAccount.balance} Eq=$${updatedAccount.equity} Time=${timestampIso}`
    );

    // 5. Success response
    return res.status(200).json({
      success: true,
      code: 'HEARTBEAT_ACCEPTED',
      message: 'MT5 worker heartbeat accepted',
      worker: {
        workerId: updatedAccount.workerId,
        accountNumber: updatedAccount.accountNumber,
        brokerServer: updatedAccount.brokerServer,
        symbol: updatedAccount.symbol || 'XAUUSD',
        workerOnline: true,
        executionEnabled: updatedAccount.executionEnabled ?? false,
        lastHeartbeat: timestampIso,
      },
    });
  } catch (error: any) {
    console.error('[MT5 Heartbeat Error]:', error);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: error?.message || 'Failed to process MT5 heartbeat',
    });
  }
});

/**
 * GET /api/mt5/status/:accountNumber
 * Returns MT5 account status with dynamically computed workerOnline freshness.
 */
mt5WorkerRouter.get('/status/:accountNumber', async (req, res) => {
  try {
    const accountNumber = String(req.params.accountNumber || '').trim();
    if (!accountNumber) {
      return res.status(400).json({ success: false, message: 'Account number is required' });
    }

    const account = await prisma.tradingAccount.findUnique({
      where: { accountNumber },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        code: 'TRADING_ACCOUNT_NOT_FOUND',
        message: 'Trading account is not registered',
      });
    }

    const online = isWorkerOnline(account.lastHeartbeat);

    return res.json({
      success: true,
      account: {
        ...account,
        workerOnline: online,
        lastHeartbeatAgeSeconds: account.lastHeartbeat
          ? Math.floor((Date.now() - new Date(account.lastHeartbeat).getTime()) / 1000)
          : null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to get status' });
  }
});

/**
 * GET /api/mt5/workers
 * Lists all registered trading accounts and their dynamic worker online statuses.
 */
mt5WorkerRouter.get('/workers', async (_req, res) => {
  try {
    const accounts = await prisma.tradingAccount.findMany();
    const formatted = accounts.map((acc: any) => ({
      ...acc,
      workerOnline: isWorkerOnline(acc.lastHeartbeat),
      lastHeartbeatAgeSeconds: acc.lastHeartbeat
        ? Math.floor((Date.now() - new Date(acc.lastHeartbeat).getTime()) / 1000)
        : null,
    }));

    return res.json({
      success: true,
      count: formatted.length,
      workers: formatted,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to list workers' });
  }
});

/**
 * PATCH /api/mt5/accounts/:accountNumber/execution
 * Allows authenticated owner to toggle executionEnabled (true/false)
 */
mt5WorkerRouter.patch('/accounts/:accountNumber/execution', requireAuth, async (req: any, res: any) => {
  try {
    const accountNumber = String(req.params.accountNumber || '').trim();
    const { executionEnabled } = req.body;

    if (!accountNumber) {
      return res.status(400).json({ success: false, message: 'Account number is required' });
    }

    const account = await prisma.tradingAccount.findUnique({
      where: { accountNumber },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        code: 'TRADING_ACCOUNT_NOT_FOUND',
        message: 'Trading account not found',
      });
    }

    // Ownership check
    if (account.userId && account.userId !== req.currentUser?.id && req.currentUser?.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You are not authorized to modify this account',
      });
    }

    const updated = await prisma.tradingAccount.update({
      where: { accountNumber },
      data: {
        executionEnabled: Boolean(executionEnabled),
      },
    });

    console.log(
      `[MT5 ACCOUNT EXECUTION TOGGLED] Account=${accountNumber} User=${req.currentUser?.id} ExecutionEnabled=${updated.executionEnabled}`
    );

    return res.json({
      success: true,
      code: 'EXECUTION_UPDATED',
      message: `MT5 execution ${updated.executionEnabled ? 'ENABLED' : 'DISABLED'} for account ${accountNumber}`,
      account: {
        ...updated,
        workerOnline: isWorkerOnline(updated.lastHeartbeat),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to update execution switch' });
  }
});
