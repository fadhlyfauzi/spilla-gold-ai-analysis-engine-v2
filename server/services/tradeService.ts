import { TradeExecutionOrder, TradeOrderStatus } from '../../src/types.js';
import { symbolService } from './symbolService.js';

export const MT5_EXECUTION_MODE: 'TEST' | 'LIVE' = 'TEST';
export const CLAIM_TIMEOUT_MS = 60 * 1000; // 60 seconds claim timeout protection

// Pre-authorized MT5 accounts (demo & live)
export const AUTHORIZED_ACCOUNTS = new Set(['MT5-DEMO-01', 'MT5-LIVE-01', 'MT5-PRO-01', 'MT5-XAUUSD-01']);

export interface ExecutionGateContext {
  tradingAccount?: {
    id: string;
    userId: string;
    accountNumber: string;
    workerId?: string | null;
    lastHeartbeat?: string | Date | null;
    executionEnabled: boolean;
    broker?: string | null;
    brokerServer?: string | null;
    symbol?: string | null;
  } | null;
  currentUser?: {
    id: string;
    email?: string;
    role?: string;
  } | null;
}

export interface ExecutionGateResult {
  valid: boolean;
  statusCode: number;
  code: string;
  message: string;
  details?: any;
}

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
   * Phase 4: Server-Side Final Execution Safety & Risk Gate.
   * Performs authoritative security, risk, trade-plan, and parameter validation.
   */
  public validateExecutionGate(
    payload: Partial<TradeExecutionOrder> & {
      isEligible?: boolean;
      eligibility?: { eligible: boolean; reasons?: string[]; codes?: string[] };
      validationStatus?: string;
      expiresAt?: string;
    },
    context?: ExecutionGateContext
  ): ExecutionGateResult {
    const { tradingAccount, currentUser } = context || {};

    // 1. Account Ownership Check (Mandatory if user context provided)
    if (currentUser && currentUser.id) {
      if (!tradingAccount) {
        return {
          valid: false,
          statusCode: 404,
          code: 'NO_TRADING_ACCOUNT',
          message: 'No connected MT5 trading account found for authenticated user.',
        };
      }

      if (tradingAccount.userId && tradingAccount.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
        return {
          valid: false,
          statusCode: 403,
          code: 'ACCOUNT_OWNERSHIP_MISMATCH',
          message: 'Trading account does not belong to authenticated user.',
        };
      }
    }

    // 2. MT5 Worker Online Check (< 30s Heartbeat)
    if (tradingAccount) {
      const now = Date.now();
      const lastHb = tradingAccount.lastHeartbeat ? new Date(tradingAccount.lastHeartbeat).getTime() : 0;
      const workerOnline = Boolean(tradingAccount.workerId && lastHb > 0 && now - lastHb <= 30 * 1000);

      if (!tradingAccount.workerId || !workerOnline) {
        return {
          valid: false,
          statusCode: 409,
          code: 'MT5_WORKER_OFFLINE',
          message: `MT5 Worker (${tradingAccount.workerId || 'UNREGISTERED'}) is OFFLINE. SPILLA EA heartbeat not detected within 30 seconds.`,
          details: {
            accountNumber: tradingAccount.accountNumber,
            workerId: tradingAccount.workerId,
            lastHeartbeat: tradingAccount.lastHeartbeat,
          },
        };
      }

      // 3. Execution Switch Check (executionEnabled === true)
      if (!tradingAccount.executionEnabled) {
        return {
          valid: false,
          statusCode: 403,
          code: 'EXECUTION_DISABLED',
          message: `Execution is disabled for trading account ${tradingAccount.accountNumber}.`,
          details: {
            accountNumber: tradingAccount.accountNumber,
            executionEnabled: false,
          },
        };
      }
    }

    // 4. Signal ID Validation & Idempotency / Duplicate Check
    const signalId = payload.signalId;
    if (!signalId || typeof signalId !== 'string' || signalId.trim() === '') {
      return {
        valid: false,
        statusCode: 400,
        code: 'INVALID_SIGNAL_ID',
        message: 'ORDER DISPATCH REJECTED: Valid unique signalId is required.',
      };
    }

    const cleanSignalId = signalId.trim();
    if (
      this.dispatchedSignals.has(cleanSignalId) ||
      this.queue.some((o) => o.signalId === cleanSignalId && o.status !== 'REJECTED' && o.status !== 'FAILED')
    ) {
      return {
        valid: false,
        statusCode: 409,
        code: 'DUPLICATE_SIGNAL',
        message: 'DUPLICATE SIGNAL — ORDER ALREADY DISPATCHED',
      };
    }

    // 5. Trade Plan Actionability Check (strictly BUY or SELL)
    const side = payload.side;
    if (side !== 'BUY' && side !== 'SELL') {
      return {
        valid: false,
        statusCode: 400,
        code: 'TRADE_NOT_ACTIONABLE',
        message: `Trade is not actionable. Order side must be strictly BUY or SELL (received: ${side || 'NONE'}).`,
      };
    }

    // 6. Signal Expiration Check
    if (payload.expiresAt) {
      const expiryTime = new Date(payload.expiresAt).getTime();
      if (!isNaN(expiryTime) && Date.now() >= expiryTime) {
        return {
          valid: false,
          statusCode: 400,
          code: 'SIGNAL_EXPIRED',
          message: 'ORDER DISPATCH REJECTED: Trade plan has expired. Please run a fresh analysis.',
        };
      }
    }

    // 7. Numeric Lot / Volume Safety Validation
    if (payload.lot === undefined || payload.lot === null || isNaN(Number(payload.lot)) || Number(payload.lot) <= 0) {
      payload.lot = (payload as any).volume;
    }
    const numericLot = Number(payload.lot);
    if (isNaN(numericLot) || !isFinite(numericLot) || numericLot <= 0) {
      return {
        valid: false,
        statusCode: 400,
        code: 'INVALID_VOLUME',
        message: 'ORDER DISPATCH REJECTED: Lot size must be a positive finite number greater than 0.',
      };
    }

    const targetSymbol = payload.symbol || 'XAUUSD';
    const spec = symbolService.getSymbol(targetSymbol);
    if (MT5_EXECUTION_MODE === 'TEST') {
      const allowedMaxLot = spec.maxTestLot || 0.01;
      if (numericLot > allowedMaxLot + 0.0001) {
        return {
          valid: false,
          statusCode: 400,
          code: 'TEST_SAFETY_CAP_EXCEEDED',
          message: `ORDER DISPATCH REJECTED: Lot size ${numericLot} exceeds hard test safety cap of ${allowedMaxLot} for ${spec.symbol}.`,
        };
      }
    }

    // 8. Normalize aliases for Price, SL, TP1, TP2
    if (payload.entryPrice === undefined || payload.entryPrice === null || isNaN(Number(payload.entryPrice)) || Number(payload.entryPrice) <= 0) {
      payload.entryPrice = (payload as any).entry_price ?? (payload as any).entry ?? (payload as any).capturePrice ?? (payload as any).capture_price;
    }
    if (payload.stopLoss === undefined || payload.stopLoss === null || isNaN(Number(payload.stopLoss)) || Number(payload.stopLoss) <= 0) {
      payload.stopLoss = (payload as any).stop_loss ?? (payload as any).sl;
    }
    if (payload.takeProfit1 === undefined || payload.takeProfit1 === null || isNaN(Number(payload.takeProfit1)) || Number(payload.takeProfit1) <= 0) {
      payload.takeProfit1 = (payload as any).take_profit_1 ?? (payload as any).tp1 ?? (payload as any).takeProfit ?? (payload as any).take_profit ?? (payload as any).take_profit1;
    }
    if (payload.takeProfit2 === undefined || payload.takeProfit2 === null || isNaN(Number(payload.takeProfit2)) || Number(payload.takeProfit2) <= 0) {
      payload.takeProfit2 = (payload as any).take_profit_2 ?? (payload as any).tp2 ?? (payload as any).take_profit2;
    }

    // 9. Entry Price Validation
    const numEntry = Number(payload.entryPrice);
    if (isNaN(numEntry) || !isFinite(numEntry) || numEntry <= 0) {
      return {
        valid: false,
        statusCode: 400,
        code: 'INVALID_ENTRY_PRICE',
        message: 'ORDER DISPATCH REJECTED: Entry price must be a positive number greater than 0.',
      };
    }

    // 10. Stop Loss Validation
    const numSL = Number(payload.stopLoss);
    if (isNaN(numSL) || !isFinite(numSL) || numSL <= 0) {
      return {
        valid: false,
        statusCode: 400,
        code: 'INVALID_STOP_LOSS',
        message: 'ORDER DISPATCH REJECTED: Stop Loss level is required and must be greater than 0.',
      };
    }

    // 11. Take Profit 1 Validation
    const numTP1 = Number(payload.takeProfit1);
    if (isNaN(numTP1) || !isFinite(numTP1) || numTP1 <= 0) {
      return {
        valid: false,
        statusCode: 400,
        code: 'INVALID_TAKE_PROFIT',
        message: 'ORDER DISPATCH REJECTED: Take Profit 1 level is required and must be greater than 0.',
      };
    }

    // 12. Pre-Dispatch Price Scale & Structural Boundary Guard (ADVISORY WARNING ONLY - NON-BLOCKING)
    const warnings: string[] = [];
    const symToValidate = (payload.canonicalSymbol || payload.symbol || 'XAUUSD').trim().toUpperCase();
    const resolvedSpec = symbolService.resolveSymbol(symToValidate);
    const canonical = resolvedSpec.canonicalSymbol;

    // Diagnostic Logging in Execution Gate
    console.log(
      `[EXECUTION PAYLOAD]\nSymbol=${canonical}\nSide=${side}\nEntry=${numEntry}\nSL=${numSL}\nTP1=${numTP1}\nTP2=${payload.takeProfit2 ? Number(payload.takeProfit2) : '—'}\nLot=${numericLot}`
    );

    // A. Symbol Plausible Price Range Advisory Check (Advisory warning only - does NOT hard-block execution)
    if (canonical === 'BTCUSD') {
      if (numEntry < 10000 || numSL < 10000 || numTP1 < 10000) {
        const warnMsg = `PRICE SCALE WARNING: BTCUSD execution price scale advisory (Entry: $${numEntry}, SL: $${numSL}, TP1: $${numTP1}). Absolute BTCUSD prices (> 10000.00) recommended.`;
        warnings.push(warnMsg);
        console.warn(`[TRADE_GATE_ADVISORY] ${warnMsg}`);
      }
    } else if (canonical === 'XAUUSD' || canonical === 'XAUUSD.CENT') {
      if (numEntry < 500 || numEntry > 15000 || numSL < 500 || numTP1 < 500) {
        const warnMsg = `PRICE SCALE WARNING: Gold execution price scale advisory (Entry: $${numEntry}, SL: $${numSL}, TP1: $${numTP1}). Standard Gold market prices (500 - 15000) recommended.`;
        warnings.push(warnMsg);
        console.warn(`[TRADE_GATE_ADVISORY] ${warnMsg}`);
      }
    } else if (canonical === 'EURUSD' || canonical === 'GBPUSD') {
      if (numEntry < 0.4 || numEntry > 3.0 || numSL < 0.4 || numTP1 < 0.4) {
        const warnMsg = `PRICE SCALE WARNING: Forex execution price scale advisory (Entry: ${numEntry}, SL: ${numSL}, TP1: ${numTP1}). Standard FX rates recommended.`;
        warnings.push(warnMsg);
        console.warn(`[TRADE_GATE_ADVISORY] ${warnMsg}`);
      }
    }

    // B. Proportional Distance Advisory Guard (Advisory warning only - does NOT hard-block execution)
    const slDistRatio = Math.abs(numSL - numEntry) / numEntry;
    const tp1DistRatio = Math.abs(numTP1 - numEntry) / numEntry;
    if (slDistRatio > 0.35 || tp1DistRatio > 0.50) {
      const warnMsg = `PRICE SCALE WARNING: Stop Loss ($${numSL}) or Take Profit ($${numTP1}) is wider than typical proportion to Entry ($${numEntry}).`;
      warnings.push(warnMsg);
      console.warn(`[TRADE_GATE_ADVISORY] ${warnMsg}`);
    }

    // 13. Structural Stop Loss & Take Profit Direction Validation
    if (side === 'BUY') {
      if (numSL >= numEntry) {
        return {
          valid: false,
          statusCode: 400,
          code: 'INVALID_STOP_LOSS',
          message: `ORDER DISPATCH REJECTED: For BUY order, Stop Loss ($${numSL}) must be strictly below Entry ($${numEntry}).`,
        };
      }
      if (numTP1 <= numEntry) {
        return {
          valid: false,
          statusCode: 400,
          code: 'INVALID_TAKE_PROFIT',
          message: `ORDER DISPATCH REJECTED: For BUY order, Take Profit ($${numTP1}) must be strictly above Entry ($${numEntry}).`,
        };
      }
      if (payload.takeProfit2 && Number(payload.takeProfit2) > 0) {
        const numTP2 = Number(payload.takeProfit2);
        if (numTP2 <= numTP1) {
          return {
            valid: false,
            statusCode: 400,
            code: 'INVALID_TAKE_PROFIT',
            message: `ORDER DISPATCH REJECTED: For BUY order, Take Profit 2 ($${numTP2}) must be strictly higher than Take Profit 1 ($${numTP1}).`,
          };
        }
      }
    } else if (side === 'SELL') {
      if (numSL <= numEntry) {
        return {
          valid: false,
          statusCode: 400,
          code: 'INVALID_STOP_LOSS',
          message: `ORDER DISPATCH REJECTED: For SELL order, Stop Loss ($${numSL}) must be strictly above Entry ($${numEntry}).`,
        };
      }
      if (numTP1 >= numEntry) {
        return {
          valid: false,
          statusCode: 400,
          code: 'INVALID_TAKE_PROFIT',
          message: `ORDER DISPATCH REJECTED: For SELL order, Take Profit ($${numTP1}) must be strictly below Entry ($${numEntry}).`,
        };
      }
      if (payload.takeProfit2 && Number(payload.takeProfit2) > 0) {
        const numTP2 = Number(payload.takeProfit2);
        if (numTP2 >= numTP1) {
          return {
            valid: false,
            statusCode: 400,
            code: 'INVALID_TAKE_PROFIT',
            message: `ORDER DISPATCH REJECTED: For SELL order, Take Profit 2 ($${numTP2}) must be strictly lower than Take Profit 1 ($${numTP1}).`,
          };
        }
      }
    }

    // 12. Risk/Reward Ratio (Calculated for advisory/informational display)
    const risk = side === 'BUY' ? numEntry - numSL : numSL - numEntry;
    const reward = side === 'BUY' ? numTP1 - numEntry : numEntry - numTP1;
    const calculatedRR = risk > 0 && reward > 0 ? Number((reward / risk).toFixed(2)) : 0;
    const tradingStyle = (payload.tradingStyle || 'INTRADAY').toUpperCase();
    const minRecommendedRR = tradingStyle === 'SCALPING' ? 1.20 : 1.50;

    return {
      valid: true,
      statusCode: 200,
      code: 'GATE_PASSED',
      message: warnings.length > 0
        ? `All safety gate checks passed with ${warnings.length} advisory warning(s).`
        : 'All execution safety and risk gate checks passed successfully.',
      details: {
        riskReward: calculatedRR,
        minRecommendedRR,
        tradingStyle,
        isRecommendedRR: calculatedRR >= minRecommendedRR,
        warnings,
      },
    };
  }

  /**
   * 1. Hardened Server-Side Validation & Enqueue
   */
  public executeOrder(
    payload: Partial<TradeExecutionOrder> & {
      isEligible?: boolean;
      eligibility?: { eligible: boolean; reasons?: string[]; codes?: string[] };
      validationStatus?: string;
      expiresAt?: string;
    },
    context?: ExecutionGateContext
  ): {
    success: boolean;
    statusCode?: number;
    code: string;
    message: string;
    details?: any;
    order?: TradeExecutionOrder;
  } {
    // Always sweep expired claims first
    this.checkClaimTimeouts();

    // Perform Phase 4 Server-Side Final Execution Gate
    const gateCheck = this.validateExecutionGate(payload, context);
    if (!gateCheck.valid) {
      console.warn(
        `[EXECUTION_GATE_BLOCKED] Signal=${payload.signalId || 'NONE'} Code=${gateCheck.code} Reason=${gateCheck.message}`
      );
      return {
        success: false,
        statusCode: gateCheck.statusCode,
        code: gateCheck.code,
        message: gateCheck.message,
        details: gateCheck.details,
      };
    }

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
    } = payload;

    const cleanSignalId = (signalId as string).trim();
    const resolvedAccount = String(accountNumber || accountId || '').trim();
    const numericLot = Number(lot);
    const numEntry = Number(entryPrice);
    const numSL = Number(stopLoss);
    const numTP1 = Number(takeProfit1);
    const numTP2 = takeProfit2 ? Number(takeProfit2) : null;

    // Construct immutable TradeExecutionOrder
    const order: TradeExecutionOrder = {
      signalId: cleanSignalId,
      snapshotId: String(snapshotId || `SNAP-${Date.now()}`),
      accountId: resolvedAccount,
      tradingAccountId: tradingAccountId ? String(tradingAccountId) : undefined,
      accountNumber: resolvedAccount,
      targetWorkerId: targetWorkerId ? String(targetWorkerId) : undefined,
      userId: userId ? String(userId) : undefined,
      broker: String(broker),
      brokerServer: String(brokerServer),
      symbol: symbol.trim(),
      side: side as 'BUY' | 'SELL',
      orderType: orderType as 'MARKET' | 'LIMIT' | 'STOP',
      lot: Number(numericLot.toFixed(2)),
      capturePrice: capturePrice ? Number(Number(capturePrice).toFixed(3)) : numEntry,
      entryPrice: Number(numEntry.toFixed(3)),
      stopLoss: Number(numSL.toFixed(3)),
      takeProfit1: Number(numTP1.toFixed(3)),
      takeProfit2: numTP2 ? Number(numTP2.toFixed(3)) : null,
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

    // Atomic Insertion into in-memory queue
    this.queue.unshift(order);
    this.dispatchedSignals.add(cleanSignalId);

    const calculatedRR = Math.abs(numTP1 - numEntry) / Math.abs(numEntry - numSL);
    console.log(
      `[EXECUTION_GATE_PASSED] Signal=${cleanSignalId} Account=${resolvedAccount} Worker=${targetWorkerId || 'ANY'} Side=${side} Lot=${order.lot} Entry=${order.entryPrice} SL=${order.stopLoss} TP=${order.takeProfit1} RR=1:${calculatedRR.toFixed(2)}`
    );

    return {
      success: true,
      statusCode: 200,
      code: 'ORDER_DISPATCHED',
      message: `ORDER DISPATCHED ✓ Order ${cleanSignalId} enqueued for MT5 execution.`,
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
