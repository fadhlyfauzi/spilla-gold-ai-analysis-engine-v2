import { Router } from 'express';
import { tradeService, MT5_EXECUTION_MODE } from '../services/tradeService.js';
import { getPrismaClient } from '../db/prisma.js';
import { requireAuth, isWorkerOnline } from './mt5WorkerRoutes.js';

export const tradeRouter = Router();
const prisma = getPrismaClient();

/**
 * POST /api/trade/execute
 * Phase 3 Secure Dynamic Execution Routing
 *
 * Resolves trading account strictly from:
 * authenticated SPILLA user -> user's connected TradingAccount ->
 * accountNumber, workerId, broker symbol, worker online status, executionEnabled status.
 */
tradeRouter.post('/execute', requireAuth, async (req: any, res: any) => {
  try {
    const payload = req.body || {};
    const currentUser = req.currentUser;

    if (!currentUser || !currentUser.id) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        error: 'ORDER DISPATCH REJECTED',
        message: 'Authentication required to execute MT5 trades.',
      });
    }

    // 1. Resolve user's connected TradingAccount from database
    let tradingAccount: any = null;

    if (payload.tradingAccountId) {
      tradingAccount = await prisma.tradingAccount.findUnique({
        where: { id: String(payload.tradingAccountId).trim() },
      });

      if (!tradingAccount) {
        return res.status(404).json({
          success: false,
          code: 'TRADING_ACCOUNT_NOT_FOUND',
          error: 'ORDER DISPATCH REJECTED',
          message: 'Specified trading account was not found.',
        });
      }

      // Enforce strict account ownership
      if (tradingAccount.userId && tradingAccount.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_OWNERSHIP_MISMATCH',
          error: 'ORDER DISPATCH REJECTED',
          message: 'Trading account does not belong to authenticated user.',
        });
      }
    } else {
      // Find the primary or most recently updated trading account for this user
      tradingAccount = await prisma.tradingAccount.findFirst({
        where: { userId: currentUser.id },
        orderBy: { updatedAt: 'desc' },
      });

      if (!tradingAccount) {
        return res.status(404).json({
          success: false,
          code: 'NO_TRADING_ACCOUNT',
          error: 'ORDER DISPATCH REJECTED',
          message: 'No connected MT5 trading account found. Please connect your trading account first.',
        });
      }
    }

    // 2. Validate Worker Online Status (Heartbeat within 30s)
    const workerOnline = isWorkerOnline(tradingAccount.lastHeartbeat);
    if (!tradingAccount.workerId || !workerOnline) {
      return res.status(409).json({
        success: false,
        code: 'MT5_WORKER_OFFLINE',
        error: 'ORDER DISPATCH REJECTED',
        message: `MT5 Worker (${tradingAccount.workerId || 'UNREGISTERED'}) is OFFLINE. Please ensure the SPILLA EA is attached and running in your MT5 terminal.`,
        account: {
          accountNumber: tradingAccount.accountNumber,
          workerId: tradingAccount.workerId,
          lastHeartbeat: tradingAccount.lastHeartbeat,
        },
      });
    }

    // 3. Validate Execution Switch (executionEnabled === true)
    if (!tradingAccount.executionEnabled) {
      return res.status(403).json({
        success: false,
        code: 'EXECUTION_DISABLED',
        error: 'ORDER DISPATCH REJECTED',
        message: `MT5 execution is DISABLED for account ${tradingAccount.accountNumber}. Enable execution in the MT5 Account settings before dispatching orders.`,
        account: {
          accountNumber: tradingAccount.accountNumber,
          executionEnabled: false,
        },
      });
    }

    // 4. Resolve broker execution symbol from connected account
    const brokerSymbol =
      tradingAccount.symbol && tradingAccount.symbol.trim()
        ? tradingAccount.symbol.trim()
        : payload.symbol || 'XAUUSD';

    // 5. Enqueue order with server-verified credentials & dynamic routing targets
    const result = tradeService.executeOrder({
      ...payload,
      tradingAccountId: tradingAccount.id,
      accountNumber: tradingAccount.accountNumber,
      accountId: tradingAccount.accountNumber,
      targetWorkerId: tradingAccount.workerId,
      userId: currentUser.id,
      broker: tradingAccount.broker || 'AIMS',
      brokerServer: tradingAccount.brokerServer || 'AIMS-Live',
      symbol: brokerSymbol,
    });

    if (!result.success) {
      const statusCode = result.code === 'DUPLICATE_SIGNAL' ? 409 : 400;
      return res.status(statusCode).json({
        success: false,
        code: result.code,
        error: result.code === 'DUPLICATE_SIGNAL' ? result.message : 'ORDER DISPATCH REJECTED',
        message: result.message,
      });
    }

    console.log(
      `[DYNAMIC EXECUTION DISPATCHED] Signal=${result.order?.signalId} User=${currentUser.id} Account=${tradingAccount.accountNumber} Worker=${tradingAccount.workerId} Symbol=${brokerSymbol}`
    );

    return res.json({
      success: true,
      code: 'ORDER_DISPATCHED',
      message: 'ORDER DISPATCHED ✓',
      status: 'PENDING MT5 EXECUTION',
      mode: MT5_EXECUTION_MODE,
      targetWorkerId: tradingAccount.workerId,
      accountNumber: tradingAccount.accountNumber,
      brokerSymbol: brokerSymbol,
      order: result.order,
    });
  } catch (err: any) {
    console.error('[Trade Execute Route Error]:', err);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'ORDER DISPATCH REJECTED',
      message: err?.message || 'Server failed to process order dispatch',
    });
  }
});

/**
 * GET /api/trade/pending
 * Consumed by SPILLA MT5 Executor EA.
 * Returns array of pending orders filtered by worker / account if specified.
 */
tradeRouter.get('/pending', (req, res) => {
  try {
    const { workerId, claimedBy, accountNumber } = req.query;
    const worker = (workerId || claimedBy) as string | undefined;
    const pendingOrders = tradeService.getPendingOrders(worker, accountNumber as string | undefined);

    res.json({
      success: true,
      mode: MT5_EXECUTION_MODE,
      count: pendingOrders.length,
      orders: pendingOrders,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/trade/claim
 * Atomically claims the next matching PENDING order and sets status to CLAIMED.
 * Strictly guarantees that workers only claim orders matching their targetWorkerId & accountNumber.
 */
tradeRouter.post('/claim', (req, res) => {
  try {
    const { claimedBy, workerId, accountNumber } = req.body || {};
    const worker = claimedBy || workerId || 'MT5_EA_WORKER_1';
    const result = tradeService.claimNextOrder(worker, accountNumber);

    if (!result.success) {
      return res.status(result.code === 'NO_PENDING_ORDERS' ? 200 : 400).json({
        success: false,
        code: result.code,
        message: result.message,
        order: null,
      });
    }

    return res.json({
      success: true,
      code: result.code,
      message: result.message,
      mode: MT5_EXECUTION_MODE,
      order: result.order,
    });
  } catch (err: any) {
    console.error('[Trade Claim Route Error]:', err);
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Failed to claim pending order',
      message: err?.message || 'Server internal error',
    });
  }
});

/**
 * POST /api/trade/processing
 * Transitions a CLAIMED order to PROCESSING state right before MT5 execution.
 */
tradeRouter.post('/processing', (req, res) => {
  try {
    const { signalId, claimedBy } = req.body || {};
    const result = tradeService.markOrderProcessing(signalId, claimedBy);

    if (!result.success) {
      const statusCode = result.code === 'ORDER_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        code: result.code,
        error: result.message,
        message: result.message,
      });
    }

    res.json({
      success: true,
      code: result.code,
      message: result.message,
      mode: MT5_EXECUTION_MODE,
      order: result.order,
    });
  } catch (err: any) {
    console.error('[Trade Processing Route Error]:', err);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Failed to mark order as processing',
      message: err?.message || 'Server internal error',
    });
  }
});

/**
 * POST /api/trade/result
 * Updates order with execution outcome (EXECUTED, REJECTED, FAILED).
 * Accepts MT5 ticket number, fill price, executed lot, or error details.
 */
tradeRouter.post('/result', (req, res) => {
  try {
    const payload = req.body || {};
    const result = tradeService.recordOrderResult(payload);

    if (!result.success) {
      const statusCode = result.code === 'ORDER_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        code: result.code,
        error: result.message,
        message: result.message,
      });
    }

    res.json({
      success: true,
      code: result.code,
      message: result.message,
      mode: MT5_EXECUTION_MODE,
      order: result.order,
    });
  } catch (err: any) {
    console.error('[Trade Result Route Error]:', err);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'Failed to record execution result',
      message: err?.message || 'Server internal error',
    });
  }
});

/**
 * GET /api/trade/orders
 * Returns all execution queue records for the debug panel.
 */
tradeRouter.get('/orders', (_req, res) => {
  try {
    const allOrders = tradeService.getAllOrders();
    res.json({
      success: true,
      mode: MT5_EXECUTION_MODE,
      count: allOrders.length,
      orders: allOrders,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/trade/clear
 * Development helper to clear queue.
 */
tradeRouter.post('/clear', (_req, res) => {
  try {
    tradeService.clearQueue();
    res.json({
      success: true,
      message: 'Execution queue cleared',
      orders: [],
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
