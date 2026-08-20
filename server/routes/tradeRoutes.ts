import { Router } from 'express';
import { tradeService, MT5_EXECUTION_MODE } from '../services/tradeService.js';

export const tradeRouter = Router();

/**
 * POST /api/trade/execute
 * Creates confirmed TradeExecutionOrder in the backend execution queue.
 * Status: PENDING (MT5_EXECUTION_MODE = TEST).
 */
tradeRouter.post('/execute', (req, res) => {
  try {
    const payload = req.body || {};
    const result = tradeService.executeOrder(payload);

    if (!result.success) {
      const statusCode = result.code === 'DUPLICATE_SIGNAL' ? 409 : 400;
      return res.status(statusCode).json({
        success: false,
        code: result.code,
        error: result.code === 'DUPLICATE_SIGNAL' ? result.message : 'ORDER DISPATCH REJECTED',
        message: result.message,
      });
    }

    res.json({
      success: true,
      code: 'ORDER_DISPATCHED',
      message: 'ORDER DISPATCHED ✓',
      status: 'PENDING MT5 EXECUTION',
      mode: MT5_EXECUTION_MODE,
      order: result.order,
    });
  } catch (err: any) {
    console.error('[Trade Execute Route Error]:', err);
    res.status(500).json({
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
 * Returns array of all orders awaiting MT5 execution.
 */
tradeRouter.get('/pending', (_req, res) => {
  try {
    const pendingOrders = tradeService.getPendingOrders();
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
 * Atomically claims the next PENDING order and sets status to CLAIMED.
 * Prevents concurrent workers/clients from claiming the same order.
 */
tradeRouter.post('/claim', (req, res) => {
  try {
    const { claimedBy } = req.body || {};
    const result = tradeService.claimNextOrder(claimedBy);

    if (!result.success) {
      return res.status(result.code === 'NO_PENDING_ORDERS' ? 200 : 400).json({
        success: false,
        code: result.code,
        message: result.message,
        order: null,
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
    console.error('[Trade Claim Route Error]:', err);
    res.status(500).json({
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
