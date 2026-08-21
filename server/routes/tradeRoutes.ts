import { Router } from 'express';
import {
  tradeService,
  MT5_EXECUTION_MODE,
} from '../services/tradeService.js';

export const tradeRouter = Router();

/**
 * POST /api/trade/execute
 * Creates confirmed TradeExecutionOrder in the execution queue.
 */
tradeRouter.post('/execute', (req, res) => {
  try {
    const payload = req.body || {};

    const result =
      tradeService.executeOrder(payload);

    if (!result.success) {
      const statusCode =
        result.code === 'DUPLICATE_SIGNAL'
          ? 409
          : 400;

      return res.status(statusCode).json({
        success: false,
        code: result.code,
        error:
          result.code === 'DUPLICATE_SIGNAL'
            ? result.message
            : 'ORDER DISPATCH REJECTED',
        message: result.message,
      });
    }

    return res.json({
      success: true,
      code: 'ORDER_DISPATCHED',
      message: 'ORDER DISPATCHED ✓',
      status: 'PENDING MT5 EXECUTION',
      mode: MT5_EXECUTION_MODE,
      order: result.order,
    });
  } catch (err: any) {
    console.error(
      '[Trade Execute Route Error]:',
      err,
    );

    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error: 'ORDER DISPATCH REJECTED',
      message:
        err?.message ||
        'Server failed to process order dispatch',
    });
  }
});

/**
 * GET /api/trade/pending
 *
 * Optional query:
 * ?workerId=MT5_1019008
 *
 * If workerId is supplied, returns orders available
 * for that worker.
 */
tradeRouter.get('/pending', (req, res) => {
  try {
    const workerId =
      typeof req.query.workerId === 'string'
        ? req.query.workerId.trim()
        : undefined;

    const pendingOrders =
      tradeService.getPendingOrders(workerId);

    return res.json({
      success: true,
      mode: MT5_EXECUTION_MODE,
      workerId: workerId || null,
      count: pendingOrders.length,
      orders: pendingOrders,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error:
        err?.message ||
        'Failed to retrieve pending orders',
    });
  }
});

/**
 * POST /api/trade/claim
 *
 * EA request example:
 *
 * {
 *   "claimedBy": "MT5_1019008",
 *   "accountNumber": "1019008"
 * }
 *
 * Only an order routed to this worker/account
 * can be claimed.
 */
tradeRouter.post('/claim', (req, res) => {
  try {
    const {
      claimedBy,
      accountNumber,
    } = req.body || {};

    if (
      !claimedBy ||
      typeof claimedBy !== 'string' ||
      claimedBy.trim() === ''
    ) {
      return res.status(400).json({
        success: false,
        code: 'WORKER_ID_REQUIRED',
        message:
          'Worker ID is required to claim an order.',
        order: null,
      });
    }

    const cleanWorkerId =
      claimedBy.trim();

    const cleanAccountNumber =
      typeof accountNumber === 'string' &&
      accountNumber.trim() !== ''
        ? accountNumber.trim()
        : undefined;

    const result =
      tradeService.claimNextOrder(
        cleanWorkerId,
        cleanAccountNumber,
      );

    if (!result.success) {
      return res
        .status(
          result.code ===
          'NO_PENDING_ORDERS'
            ? 200
            : 400,
        )
        .json({
          success: false,
          code: result.code,
          message: result.message,
          workerId: cleanWorkerId,
          accountNumber:
            cleanAccountNumber || null,
          order: null,
        });
    }

    return res.json({
      success: true,
      code: result.code,
      message: result.message,
      mode: MT5_EXECUTION_MODE,
      workerId: cleanWorkerId,
      accountNumber:
        cleanAccountNumber || null,
      order: result.order,
    });
  } catch (err: any) {
    console.error(
      '[Trade Claim Route Error]:',
      err,
    );

    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error:
        'Failed to claim pending order',
      message:
        err?.message ||
        'Server internal error',
    });
  }
});

/**
 * POST /api/trade/processing
 *
 * EA request example:
 *
 * {
 *   "signalId": "SIG-...",
 *   "claimedBy": "MT5_1019008"
 * }
 */
tradeRouter.post(
  '/processing',
  (req, res) => {
    try {
      const {
        signalId,
        claimedBy,
      } = req.body || {};

      if (
        !signalId ||
        typeof signalId !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SIGNAL_ID',
          message:
            'signalId is required.',
        });
      }

      if (
        !claimedBy ||
        typeof claimedBy !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          code: 'WORKER_ID_REQUIRED',
          message:
            'claimedBy is required.',
        });
      }

      const result =
        tradeService.markOrderProcessing(
          signalId.trim(),
          claimedBy.trim(),
        );

      if (!result.success) {
        const statusCode =
          result.code ===
          'ORDER_NOT_FOUND'
            ? 404
            : 400;

        return res
          .status(statusCode)
          .json({
            success: false,
            code: result.code,
            error: result.message,
            message: result.message,
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
      console.error(
        '[Trade Processing Route Error]:',
        err,
      );

      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        error:
          'Failed to mark order as processing',
        message:
          err?.message ||
          'Server internal error',
      });
    }
  },
);

/**
 * POST /api/trade/result
 *
 * EA should now also send claimedBy.
 *
 * Example:
 *
 * {
 *   "signalId": "SIG-...",
 *   "claimedBy": "MT5_1019008",
 *   "status": "EXECUTED",
 *   "mt5Ticket": "123456",
 *   "fillPrice": 4528.10,
 *   "executedLot": 0.10
 * }
 */
tradeRouter.post('/result', (req, res) => {
  try {
    const payload = req.body || {};

    if (
      !payload.signalId ||
      typeof payload.signalId !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SIGNAL_ID',
        message:
          'signalId is required.',
      });
    }

    const result =
      tradeService.recordOrderResult(
        payload,
      );

    if (!result.success) {
      const statusCode =
        result.code ===
        'ORDER_NOT_FOUND'
          ? 404
          : 400;

      return res
        .status(statusCode)
        .json({
          success: false,
          code: result.code,
          error: result.message,
          message: result.message,
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
    console.error(
      '[Trade Result Route Error]:',
      err,
    );

    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error:
        'Failed to record execution result',
      message:
        err?.message ||
        'Server internal error',
    });
  }
});

/**
 * GET /api/trade/orders
 *
 * Returns all execution queue records.
 * This endpoint is intended for admin/debug use.
 */
tradeRouter.get('/orders', (_req, res) => {
  try {
    const allOrders =
      tradeService.getAllOrders();

    return res.json({
      success: true,
      mode: MT5_EXECUTION_MODE,
      count: allOrders.length,
      orders: allOrders,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error:
        err?.message ||
        'Failed to retrieve orders',
    });
  }
});

/**
 * GET /api/trade/orders/user/:userId
 *
 * Returns orders belonging to a specific website user.
 */
tradeRouter.get(
  '/orders/user/:userId',
  (req, res) => {
    try {
      const userId =
        String(
          req.params.userId || '',
        ).trim();

      if (!userId) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_USER_ID',
          message:
            'Valid userId is required.',
        });
      }

      const orders =
        tradeService.getOrdersByUserId(
          userId,
        );

      return res.json({
        success: true,
        count: orders.length,
        orders,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        error:
          err?.message ||
          'Failed to retrieve user orders',
      });
    }
  },
);

/**
 * GET /api/trade/orders/account/:tradingAccountId
 *
 * Returns orders belonging to a specific trading account.
 */
tradeRouter.get(
  '/orders/account/:tradingAccountId',
  (req, res) => {
    try {
      const tradingAccountId =
        String(
          req.params
            .tradingAccountId || '',
        ).trim();

      if (!tradingAccountId) {
        return res.status(400).json({
          success: false,
          code:
            'INVALID_TRADING_ACCOUNT_ID',
          message:
            'Valid tradingAccountId is required.',
        });
      }

      const orders =
        tradeService
          .getOrdersByTradingAccountId(
            tradingAccountId,
          );

      return res.json({
        success: true,
        count: orders.length,
        orders,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        error:
          err?.message ||
          'Failed to retrieve trading account orders',
      });
    }
  },
);

/**
 * POST /api/trade/clear
 *
 * Development helper.
 * Do not expose this publicly in the final production version.
 */
tradeRouter.post('/clear', (_req, res) => {
  try {
    tradeService.clearQueue();

    return res.json({
      success: true,
      message:
        'Execution queue cleared',
      orders: [],
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      error:
        err?.message ||
        'Failed to clear queue',
    });
  }
});