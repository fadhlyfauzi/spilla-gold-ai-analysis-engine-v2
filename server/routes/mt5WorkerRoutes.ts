import { Router } from 'express';
import { getPrismaClient } from '../db/prisma.js';

export const mt5WorkerRouter = Router();
const prisma = getPrismaClient();

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
