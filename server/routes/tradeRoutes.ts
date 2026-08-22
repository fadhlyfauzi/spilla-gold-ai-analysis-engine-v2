import { Router } from 'express';
import { tradeService, MT5_EXECUTION_MODE } from '../services/tradeService.js';
import { symbolService } from '../services/symbolService.js';
import { getPrismaClient } from '../db/prisma.js';
import { requireAuth, isWorkerOnline } from './mt5WorkerRoutes.js';

export const tradeRouter = Router();
const prisma = getPrismaClient();

/**
 * POST /api/trade/validate-gate
 * Phase 4 Pre-flight Execution Safety & Risk Gate Check
 */
tradeRouter.post('/validate-gate', requireAuth, async (req: any, res: any) => {
  try {
    const payload = req.body || {};
    const currentUser = req.currentUser;

    if (!currentUser || !currentUser.id) {
      return res.status(401).json({
        valid: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
    }

    let tradingAccount: any = null;
    if (payload.tradingAccountId) {
      tradingAccount = await prisma.tradingAccount.findUnique({
        where: { id: String(payload.tradingAccountId).trim() },
      });
    } else {
      tradingAccount = await prisma.tradingAccount.findFirst({
        where: { userId: currentUser.id },
        orderBy: { updatedAt: 'desc' },
      });
    }

    const inputSymbol = payload.canonicalSymbol || payload.symbol || 'XAUUSD';
    const canonicalSymbol = symbolService.resolveSymbol(inputSymbol).canonicalSymbol;
    payload.symbol = canonicalSymbol;
    payload.canonicalSymbol = canonicalSymbol;

    const gateResult = tradeService.validateExecutionGate(payload, {
      tradingAccount,
      currentUser,
    });

    return res.status(gateResult.statusCode || 200).json({
      success: gateResult.valid,
      valid: gateResult.valid,
      code: gateResult.code,
      message: gateResult.message,
      details: gateResult.details,
      account: tradingAccount
        ? {
            accountNumber: tradingAccount.accountNumber,
            broker: tradingAccount.broker,
            brokerServer: tradingAccount.brokerServer,
            workerId: tradingAccount.workerId,
            workerOnline: isWorkerOnline(tradingAccount.lastHeartbeat),
            executionEnabled: Boolean(tradingAccount.executionEnabled),
            symbol: tradingAccount.symbol,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[Trade Validate Gate Error]:', err);
    return res.status(500).json({
      valid: false,
      code: 'INTERNAL_ERROR',
      message: err?.message || 'Server failed to validate execution gate',
    });
  }
});

/**
 * POST /api/trade/execute
 * Phase 4 Server-Side Final Execution Safety & Risk Gate
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

    // 2. Resolve canonical symbol and broker execution symbol
    const inputSymbol = payload.canonicalSymbol || payload.symbol || 'XAUUSD';
    const canonicalSymbol = symbolService.resolveSymbol(inputSymbol).canonicalSymbol;
    const brokerSymbol =
      payload.brokerSymbol && payload.brokerSymbol.trim()
        ? payload.brokerSymbol.trim()
        : symbolService.mapCanonicalToBroker(canonicalSymbol, tradingAccount.symbol);

    // 3. Execute order through authoritative server-side execution & risk gate
    // CRITICAL: order.symbol must ALWAYS be the canonical SPILLA GOLD symbol (e.g. BTCUSD, XAUUSD, EURUSD)
    // Broker-specific symbol (e.g. BTCUSD.edge) is stored separately as brokerSymbol and used by the MT5 mapping layer
    const numEntry = Number(payload.entryPrice ?? payload.entry_price ?? payload.capturePrice ?? payload.capture_price);
    const numSL = Number(payload.stopLoss ?? payload.stop_loss ?? payload.sl);
    const numTP1 = Number(payload.takeProfit1 ?? payload.take_profit_1 ?? payload.tp1 ?? payload.takeProfit ?? payload.take_profit ?? payload.take_profit1);
    const numTP2 = payload.takeProfit2 !== null && payload.takeProfit2 !== undefined ? Number(payload.takeProfit2) : (payload.take_profit_2 ? Number(payload.take_profit_2) : (payload.tp2 ? Number(payload.tp2) : null));
    const numLot = Number(payload.lot ?? payload.volume);

    // Temporary Diagnostic Logging
    console.log(
      `[EXECUTION PAYLOAD]\nSymbol=${canonicalSymbol}\nSide=${payload.side}\nEntry=${numEntry}\nSL=${numSL}\nTP1=${numTP1}\nTP2=${numTP2 ?? '—'}\nLot=${numLot}`
    );

    const orderPayload = {
      ...payload,
      entryPrice: numEntry,
      stopLoss: numSL,
      takeProfit1: numTP1,
      takeProfit2: numTP2,
      lot: numLot,
      tradingAccountId: tradingAccount.id,
      accountNumber: tradingAccount.accountNumber,
      accountId: tradingAccount.accountNumber,
      targetWorkerId: tradingAccount.workerId,
      userId: currentUser.id,
      broker: tradingAccount.broker || 'AIMS',
      brokerServer: tradingAccount.brokerServer || 'AIMS-Live',
      symbol: canonicalSymbol,
      canonicalSymbol: canonicalSymbol,
      brokerSymbol: brokerSymbol,
    };

    const result = tradeService.executeOrder(orderPayload, {
      tradingAccount,
      currentUser,
    });

    if (!result.success) {
      const statusCode = result.statusCode || 400;
      return res.status(statusCode).json({
        success: false,
        code: result.code,
        error: 'ORDER DISPATCH REJECTED',
        message: result.message,
        details: result.details,
      });
    }

    console.log(
      `[DYNAMIC EXECUTION DISPATCHED] Signal=${result.order?.signalId} User=${currentUser.id} Account=${tradingAccount.accountNumber} Worker=${tradingAccount.workerId} CanonicalSymbol=${canonicalSymbol} BrokerSymbol=${brokerSymbol}`
    );

    return res.json({
      success: true,
      code: 'ORDER_DISPATCHED',
      message: 'ORDER DISPATCHED ✓',
      status: 'PENDING MT5 EXECUTION',
      mode: MT5_EXECUTION_MODE,
      targetWorkerId: tradingAccount.workerId,
      accountNumber: tradingAccount.accountNumber,
      canonicalSymbol: canonicalSymbol,
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
