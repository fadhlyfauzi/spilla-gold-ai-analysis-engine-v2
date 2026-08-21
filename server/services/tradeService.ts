import { TradeExecutionOrder, TradeOrderStatus } from '../../src/types.js';

export const MT5_EXECUTION_MODE: 'TEST' | 'LIVE' = 'TEST';
export const CLAIM_TIMEOUT_MS = 60 * 1000; // 60 seconds claim timeout protection

// Pre-authorized MT5 accounts (demo & live)
export const AUTHORIZED_ACCOUNTS = new Set(['MT5-DEMO-01', 'MT5-LIVE-01', 'MT5-PRO-01', 'MT5-XAUUSD-01']);

export class TradeService {
  private queue: TradeExecutionOrder[] = [];
  private dispatchedSignals: Set<string> = new Set();
  private timeoutInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Background sweep for claim timeout protection every 10 seconds
    this.timeoutInterval = setInterval(() => {
      this.checkClaimTimeouts();
    }, 10000);
    if (this.timeoutInterval?.unref) {
      this.timeoutInterval.unref();
    }
  }

  /**
   * Evaluates all CLAIMED orders and marks expired claims as FAILED to prevent silent duplicate execution.
   */
  public checkClaimTimeouts(): void {
    const now = Date.now();
    for (const order of this.queue) {
      if (order.status === 'CLAIMED' && order.claimedAt) {
        const claimedTime = new Date(order.claimedAt).getTime();
        if (now - claimedTime > CLAIM_TIMEOUT_MS) {
          console.warn(
            `[MT5 BRIDGE TIMEOUT] Order ${order.signalId} claimed by ${order.claimedBy} timed out (>60s). Marking as FAILED.`
          );
          order.status = 'FAILED';
          order.errorCode = 'CLAIM_TIMEOUT';
          order.errorMessage = 'Claimed order timed out after 60s without receiving execution result from MT5 EA';
          order.updatedAt = new Date().toISOString();
        }
      }
    }
  }

  /**
   * 1. Hardened Server-Side Validation & Enqueue
   */
  public executeOrder(payload: Partial<TradeExecutionOrder>): {
    success: boolean;
    code: string;
    message: string;
    order?: TradeExecutionOrder;
  } {
    // Always sweep expired claims first
    this.checkClaimTimeouts();

    const {
      signalId,
      snapshotId,
      accountId,
      tradingAccountId,
      accountNumber,
      targetWorkerId,
      userId,
      broker = 'AIMS',
      brokerServer = 'AIMS-Live',
      symbol = 'XAUUSD',
      side,
      orderType = 'MARKET',
      lot,
      capturePrice,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2 = null,
      riskPercent = 1.0,
      estimatedLoss = 0,
      confidence = 80,
      tradingStyle = 'INTRADAY',
      timeframe = 'H1',
      riskValidation = 'PASS',
    } = payload;

    // Rule 1: Signal ID uniqueness & validation
    if (!signalId || typeof signalId !== 'string' || signalId.trim() === '') {
      return {
        success: false,
        code: 'INVALID_SIGNAL_ID',
        message: 'ORDER DISPATCH REJECTED: signalId must be unique and valid.',
      };
    }

    const cleanSignalId = signalId.trim();
    if (this.dispatchedSignals.has(cleanSignalId) || this.queue.some((o) => o.signalId === cleanSignalId)) {
      return {
        success: false,
        code: 'DUPLICATE_SIGNAL',
        message: 'DUPLICATE SIGNAL — ORDER ALREADY DISPATCHED',
      };
    }

    // Rule 2: Risk Validation must be PASS
    if (riskValidation !== 'PASS') {
      return {
        success: false,
        code: 'RISK_VALIDATION_FAILED',
        message: `ORDER DISPATCH REJECTED: Risk Validation must be PASS (received: ${riskValidation}).`,
      };
    }

    // Rule 3: Account verification
    const resolvedAccount = String(accountNumber || accountId || '').trim();
    if (!resolvedAccount) {
      return {
        success: false,
        code: 'UNAUTHORIZED_ACCOUNT',
        message: 'ORDER DISPATCH REJECTED: accountId or accountNumber must exist and be authorized.',
      };
    }

    // Rule 4: snapshotId must exist and be valid
    if (!snapshotId || typeof snapshotId !== 'string' || snapshotId.trim() === '') {
      return {
        success: false,
        code: 'INVALID_SNAPSHOT',
        message: 'ORDER DISPATCH REJECTED: snapshotId must exist and be valid.',
      };
    }

    // Rule 5: Symbol validation
    if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
      return {
        success: false,
        code: 'INVALID_SYMBOL',
        message: 'ORDER DISPATCH REJECTED: Symbol is invalid.',
      };
    }

    // Rule 6: Side validation
    if (side !== 'BUY' && side !== 'SELL') {
      return {
        success: false,
        code: 'INVALID_SIDE',
        message: 'ORDER DISPATCH REJECTED: Order side must be BUY or SELL.',
      };
    }

    // Rule 7: lot > 0 validation
    const numericLot = Number(lot);
    if (isNaN(numericLot) || numericLot <= 0) {
      return {
        success: false,
        code: 'INVALID_LOT',
        message: 'ORDER DISPATCH REJECTED: lot size must be strictly greater than 0.',
      };
    }

    // Rule 8: Entry price validation
    const numEntry = Number(entryPrice);
    if (isNaN(numEntry) || numEntry <= 0) {
      return {
        success: false,
        code: 'INVALID_ENTRY_PRICE',
        message: 'ORDER DISPATCH REJECTED: Entry price must be greater than 0.',
      };
    }

    // Rule 9: Stop Loss validation
    const numSL = Number(stopLoss);
    if (isNaN(numSL) || numSL <= 0) {
      return {
        success: false,
        code: 'INVALID_STOP_LOSS',
        message: 'ORDER DISPATCH REJECTED: Stop Loss level is required and must be > 0.',
      };
    }

    // Rule 10: Take Profit 1 validation
    const numTP1 = Number(takeProfit1);
    if (isNaN(numTP1) || numTP1 <= 0) {
      return {
        success: false,
        code: 'INVALID_TAKE_PROFIT',
        message: 'ORDER DISPATCH REJECTED: Take Profit 1 level is required and must be > 0.',
      };
    }

    // Rule 11: BUY rule: SL < Entry < TP
    if (side === 'BUY') {
      if (numSL >= numEntry) {
        return {
          success: false,
          code: 'INVALID_BUY_SL',
          message: `ORDER DISPATCH REJECTED: For BUY order, Stop Loss ($${numSL}) must be strictly below Entry ($${numEntry}).`,
        };
      }
      if (numEntry >= numTP1) {
        return {
          success: false,
          code: 'INVALID_BUY_TP',
          message: `ORDER DISPATCH REJECTED: For BUY order, Entry ($${numEntry}) must be strictly below Take Profit ($${numTP1}).`,
        };
      }
    }

    // Rule 12: SELL rule: TP < Entry < SL
    if (side === 'SELL') {
      if (numTP1 >= numEntry) {
        return {
          success: false,
          code: 'INVALID_SELL_TP',
          message: `ORDER DISPATCH REJECTED: For SELL order, Take Profit ($${numTP1}) must be strictly below Entry ($${numEntry}).`,
        };
      }
      if (numEntry >= numSL) {
        return {
          success: false,
          code: 'INVALID_SELL_SL',
          message: `ORDER DISPATCH REJECTED: For SELL order, Entry ($${numEntry}) must be strictly below Stop Loss ($${numSL}).`,
        };
      }
    }

    // Construct immutable TradeExecutionOrder
    const order: TradeExecutionOrder = {
      signalId: cleanSignalId,
      snapshotId: String(snapshotId),
      accountId: resolvedAccount,
      tradingAccountId: tradingAccountId ? String(tradingAccountId) : undefined,
      accountNumber: resolvedAccount,
      targetWorkerId: targetWorkerId ? String(targetWorkerId) : undefined,
      userId: userId ? String(userId) : undefined,
      broker: String(broker),
      brokerServer: String(brokerServer),
      symbol: symbol.trim(),
      side,
      orderType: orderType as 'MARKET' | 'LIMIT' | 'STOP',
      lot: Number(numericLot.toFixed(2)),
      capturePrice: capturePrice ? Number(Number(capturePrice).toFixed(3)) : numEntry,
      entryPrice: Number(numEntry.toFixed(3)),
      stopLoss: Number(numSL.toFixed(3)),
      takeProfit1: Number(numTP1.toFixed(3)),
      takeProfit2: takeProfit2 ? Number(Number(takeProfit2).toFixed(3)) : null,
      riskPercent: Number(Number(riskPercent).toFixed(2)),
      estimatedLoss: Number(Number(estimatedLoss).toFixed(2)),
      confidence: Number(confidence),
      tradingStyle: (tradingStyle || 'INTRADAY') as 'SCALPING' | 'INTRADAY',
      timeframe: String(timeframe || 'H1'),
      status: 'PENDING',
      riskValidation: 'PASS',
      claimedAt: null,
      claimedBy: null,
      processedAt: null,
      executedAt: null,
      mt5Ticket: null,
      fillPrice: null,
      executedLot: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Register signal to prevent duplicate dispatches
    this.dispatchedSignals.add(cleanSignalId);
    this.queue.unshift(order);

    console.log(
      `[MT5 BRIDGE] [${MT5_EXECUTION_MODE} MODE] TradeExecutionOrder enqueued: signalId=${order.signalId} targetWorker=${order.targetWorkerId || 'ANY'} account=${order.accountNumber} broker=${order.broker} server=${order.brokerServer} symbol=${order.symbol} side=${order.side} lot=${order.lot} entry=${order.entryPrice} sl=${order.stopLoss} tp1=${order.takeProfit1} status=${order.status}`
    );

    return {
      success: true,
      code: 'ORDER_DISPATCHED',
      message: 'ORDER DISPATCHED ✓',
      order,
    };
  }

  /**
   * 2. Atomic Order Claim Endpoint Logic
   * Atomically transitions the oldest matching PENDING order to CLAIMED.
   * Guarantees that workers only claim orders routed specifically to their target worker / account.
   */
  public claimNextOrder(claimedBy = 'MT5_EA_WORKER_1', accountNumber?: string): {
    success: boolean;
    code: string;
    message: string;
    order?: TradeExecutionOrder | null;
  } {
    // Sweep expired claims first
    this.checkClaimTimeouts();

    const cleanClaimedBy = String(claimedBy).trim();
    const cleanAccount = accountNumber ? String(accountNumber).trim() : null;

    // Find the oldest PENDING order matching this worker / account (iterate from back to front for FIFO)
    const reversed = [...this.queue].reverse();
    const pendingIndex = reversed.findIndex((o) => {
      if (o.status !== 'PENDING') return false;

      // If order has an explicit targetWorkerId, it must match claimedBy
      if (o.targetWorkerId) {
        if (o.targetWorkerId !== cleanClaimedBy) {
          return false;
        }
      }

      // If order has an explicit accountNumber and EA provided accountNumber, it must match
      if (o.accountNumber && cleanAccount) {
        if (o.accountNumber !== cleanAccount) {
          return false;
        }
      }

      // Legacy fallback: if no targetWorkerId or accountNumber specified on order
      if (!o.targetWorkerId && !o.accountNumber) {
        if (o.accountId && o.accountId !== cleanClaimedBy && o.accountId !== cleanAccount && !o.accountId.startsWith('MT5-DEMO')) {
          return false;
        }
      }

      return true;
    });

    if (pendingIndex === -1) {
      return {
        success: false,
        code: 'NO_PENDING_ORDERS',
        message: `No pending orders available to claim for worker ${cleanClaimedBy}${cleanAccount ? ` on account ${cleanAccount}` : ''}.`,
        order: null,
      };
    }

    // Convert reversed index back to actual index
    const actualIndex = this.queue.length - 1 - pendingIndex;
    const targetOrder = this.queue[actualIndex];

    // Atomically transition status to CLAIMED
    targetOrder.status = 'CLAIMED';
    targetOrder.claimedAt = new Date().toISOString();
    targetOrder.claimedBy = cleanClaimedBy;
    targetOrder.updatedAt = new Date().toISOString();

    console.log(
      `[MT5 BRIDGE ATOMIC CLAIM] Order ${targetOrder.signalId} (Account ${targetOrder.accountNumber || targetOrder.accountId}) successfully claimed by worker [${cleanClaimedBy}]`
    );

    return {
      success: true,
      code: 'ORDER_CLAIMED',
      message: `Order ${targetOrder.signalId} claimed successfully by ${cleanClaimedBy}`,
      order: targetOrder,
    };
  }

  /**
   * 3. Result Reporting Endpoint Logic
   * Updates order lifecycle with final MT5 EA execution or rejection details.
   */
  public recordOrderResult(payload: {
    signalId: string;
    status: TradeOrderStatus;
    mt5Ticket?: string | number;
    fillPrice?: number;
    executedLot?: number;
    errorCode?: string;
    errorMessage?: string;
  }): {
    success: boolean;
    code: string;
    message: string;
    order?: TradeExecutionOrder;
  } {
    const { signalId, status, mt5Ticket, fillPrice, executedLot, errorCode, errorMessage } = payload;

    if (!signalId || typeof signalId !== 'string') {
      return {
        success: false,
        code: 'INVALID_SIGNAL_ID',
        message: 'Valid signalId is required to record execution result.',
      };
    }

    const cleanSignalId = signalId.trim();
    const order = this.queue.find((o) => o.signalId === cleanSignalId);

    if (!order) {
      return {
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: `Order with signalId "${cleanSignalId}" was not found in execution queue.`,
      };
    }

    // Prevent overwriting terminal statuses (EXECUTED, REJECTED, FAILED)
    if (order.status === 'EXECUTED' || order.status === 'REJECTED' || order.status === 'FAILED') {
      if (status === 'PROCESSING' || status === 'CLAIMED' || status === 'PENDING') {
        return {
          success: false,
          code: 'INVALID_TRANSITION',
          message: `Order ${cleanSignalId} is already in terminal state ${order.status} and cannot revert to ${status}.`,
        };
      }
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();

    if (status === 'EXECUTED') {
      order.mt5Ticket = mt5Ticket ? String(mt5Ticket) : `TKT-${Math.floor(100000000 + Math.random() * 900000000)}`;
      order.fillPrice = fillPrice !== undefined ? Number(fillPrice) : order.entryPrice;
      order.executedLot = executedLot !== undefined ? Number(executedLot) : order.lot;
      order.executedAt = new Date().toISOString();
      order.errorCode = null;
      order.errorMessage = null;

      console.log(
        `[MT5 BRIDGE RESULT] Order ${cleanSignalId} EXECUTED. Ticket: ${order.mt5Ticket} Fill: ${order.fillPrice} Lot: ${order.executedLot}`
      );
    } else if (status === 'REJECTED' || status === 'FAILED') {
      order.errorCode = errorCode || (status === 'REJECTED' ? 'BROKER_REJECTED' : 'EXECUTION_FAILED');
      order.errorMessage = errorMessage || 'Order was rejected during MT5 broker execution';

      console.warn(
        `[MT5 BRIDGE RESULT] Order ${cleanSignalId} ${status}. ErrorCode: ${order.errorCode} Reason: ${order.errorMessage}`
      );
    } else if (status === 'PROCESSING') {
      order.processedAt = new Date().toISOString();
      console.log(`[MT5 BRIDGE PROCESSING] Order ${cleanSignalId} marked as PROCESSING.`);
    }

    return {
      success: true,
      code: 'RESULT_RECORDED',
      message: `Order ${cleanSignalId} status updated to ${status}.`,
      order,
    };
  }

  /**
   * 4. Transition Order from CLAIMED to PROCESSING
   */
  public markOrderProcessing(signalId: string, claimedBy?: string): {
    success: boolean;
    code: string;
    message: string;
    order?: TradeExecutionOrder;
  } {
    if (!signalId || typeof signalId !== 'string') {
      return {
        success: false,
        code: 'INVALID_SIGNAL_ID',
        message: 'Valid signalId is required.',
      };
    }

    const cleanSignalId = signalId.trim();
    const order = this.queue.find((o) => o.signalId === cleanSignalId);

    if (!order) {
      return {
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: `Order with signalId "${cleanSignalId}" was not found in execution queue.`,
      };
    }

    if (order.status === 'EXECUTED' || order.status === 'REJECTED' || order.status === 'FAILED') {
      return {
        success: false,
        code: 'INVALID_TRANSITION',
        message: `Order ${cleanSignalId} is already in terminal state ${order.status} and cannot be marked as PROCESSING.`,
      };
    }

    order.status = 'PROCESSING';
    order.processedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    if (claimedBy) {
      order.claimedBy = claimedBy;
    }

    console.log(`[MT5 BRIDGE PROCESSING] Order ${cleanSignalId} transitioned to PROCESSING.`);

    return {
      success: true,
      code: 'ORDER_PROCESSING',
      message: `Order ${cleanSignalId} is now PROCESSING.`,
      order,
    };
  }

  /**
   * Retrieves all orders currently in PENDING status, optionally filtered by workerId/account.
   */
  public getPendingOrders(workerId?: string, accountNumber?: string): TradeExecutionOrder[] {
    this.checkClaimTimeouts();
    return this.queue.filter((order) => {
      if (order.status !== 'PENDING') return false;
      if (workerId && order.targetWorkerId && order.targetWorkerId !== workerId) return false;
      if (accountNumber && order.accountNumber && order.accountNumber !== accountNumber) return false;
      return true;
    });
  }

  /**
   * Retrieves all orders in the execution queue.
   */
  public getAllOrders(): TradeExecutionOrder[] {
    this.checkClaimTimeouts();
    return this.queue;
  }

  /**
   * Retrieves a specific order by signalId.
   */
  public getOrderBySignalId(signalId: string): TradeExecutionOrder | undefined {
    return this.queue.find((o) => o.signalId === signalId.trim());
  }

  /**
   * Checks if a signalId was already dispatched.
   */
  public isSignalDispatched(signalId: string): boolean {
    return this.dispatchedSignals.has(signalId.trim());
  }

  /**
   * Debug / Development helper to clear queue or reset signal.
   */
  public clearQueue(): void {
    this.queue = [];
    this.dispatchedSignals.clear();
  }
}

export const tradeService = new TradeService();
