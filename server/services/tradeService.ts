import {
  TradeExecutionOrder,
  TradeOrderStatus,
} from '../../src/types.js';

export const MT5_EXECUTION_MODE: 'TEST' | 'LIVE' = 'TEST';

export const CLAIM_TIMEOUT_MS = 60 * 1000;

// Legacy authorized accounts.
// Dipertahankan agar flow existing tetap kompatibel.
export const AUTHORIZED_ACCOUNTS = new Set([
  'MT5-DEMO-01',
  'MT5-LIVE-01',
  'MT5-PRO-01',
  'MT5-XAUUSD-01',
]);

export class TradeService {
  private queue: TradeExecutionOrder[] = [];

  private dispatchedSignals: Set<string> =
    new Set();

  private timeoutInterval:
    | NodeJS.Timeout
    | null = null;

  constructor() {
    // ==============================================================
    // CLAIM TIMEOUT WATCHER
    // ==============================================================
    this.timeoutInterval = setInterval(
      () => {
        this.checkClaimTimeouts();
      },
      10000,
    );

    if (this.timeoutInterval?.unref) {
      this.timeoutInterval.unref();
    }
  }

  // ================================================================
  // CLAIM TIMEOUT PROTECTION
  // ================================================================

  public checkClaimTimeouts(): void {
    const now = Date.now();

    for (const order of this.queue) {
      if (
        order.status === 'CLAIMED' &&
        order.claimedAt
      ) {
        const claimedTime =
          new Date(
            order.claimedAt,
          ).getTime();

        if (
          now - claimedTime >
          CLAIM_TIMEOUT_MS
        ) {
          console.warn(
            `[MT5 BRIDGE TIMEOUT] Order ${order.signalId} ` +
              `claimed by ${order.claimedBy} timed out (>60s).`,
          );

          order.status = 'FAILED';

          order.errorCode =
            'CLAIM_TIMEOUT';

          order.errorMessage =
            'Claimed order timed out after 60 seconds without MT5 execution result.';

          order.updatedAt =
            new Date().toISOString();
        }
      }
    }
  }

  // ================================================================
  // 1. EXECUTE / ENQUEUE ORDER
  // ================================================================

  public executeOrder(
    payload: Partial<TradeExecutionOrder>,
  ): {
    success: boolean;
    code: string;
    message: string;
    order?: TradeExecutionOrder;
  } {
    this.checkClaimTimeouts();

    const {
      // ============================================================
      // IDENTIFIERS
      // ============================================================
      signalId,
      snapshotId,

      userId,
      tradingAccountId,

      accountId = 'MT5-DEMO-01',
      accountNumber,
      targetWorkerId,

      // ============================================================
      // TRADE DATA
      // ============================================================
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

    // ==============================================================
    // RULE 1 — SIGNAL ID
    // ==============================================================

    if (
      !signalId ||
      typeof signalId !== 'string' ||
      signalId.trim() === ''
    ) {
      return {
        success: false,
        code: 'INVALID_SIGNAL_ID',
        message:
          'ORDER DISPATCH REJECTED: signalId must be valid.',
      };
    }

    const cleanSignalId =
      signalId.trim();

    if (
      this.dispatchedSignals.has(
        cleanSignalId,
      ) ||
      this.queue.some(
        (o) =>
          o.signalId ===
          cleanSignalId,
      )
    ) {
      return {
        success: false,
        code: 'DUPLICATE_SIGNAL',
        message:
          'DUPLICATE SIGNAL — ORDER ALREADY DISPATCHED',
      };
    }

    // ==============================================================
    // RULE 2 — RISK VALIDATION
    // ==============================================================

    if (
      riskValidation !== 'PASS'
    ) {
      return {
        success: false,
        code:
          'RISK_VALIDATION_FAILED',

        message:
          `ORDER DISPATCH REJECTED: ` +
          `Risk Validation must be PASS ` +
          `(received: ${riskValidation}).`,
      };
    }

    // ==============================================================
    // RULE 3 — ACCOUNT
    // ==============================================================

    if (
      !accountId ||
      typeof accountId !==
        'string' ||
      accountId.trim() === ''
    ) {
      return {
        success: false,
        code:
          'INVALID_ACCOUNT',

        message:
          'ORDER DISPATCH REJECTED: accountId is required.',
      };
    }

    const cleanAccountId =
      accountId.trim();

    // Tidak lagi membatasi hanya predefined account.
    // Ini diperlukan untuk multi-user / UUID trading account.
    //
    // Legacy AUTHORIZED_ACCOUNTS tetap dipertahankan,
    // tapi tidak lagi menjadi satu-satunya sumber authorization.

    // ==============================================================
    // CLEAN ROUTING VALUES
    // ==============================================================

    const cleanUserId =
      typeof userId === 'string' &&
      userId.trim() !== ''
        ? userId.trim()
        : undefined;

    const cleanTradingAccountId =
      typeof tradingAccountId ===
        'string' &&
      tradingAccountId.trim() !== ''
        ? tradingAccountId.trim()
        : undefined;

    const cleanAccountNumber =
      typeof accountNumber ===
        'string' &&
      accountNumber.trim() !== ''
        ? accountNumber.trim()
        : undefined;

    const cleanTargetWorkerId =
      typeof targetWorkerId ===
        'string' &&
      targetWorkerId.trim() !== ''
        ? targetWorkerId.trim()
        : undefined;

    // ==============================================================
    // RULE 4 — SNAPSHOT
    // ==============================================================

    if (
      !snapshotId ||
      typeof snapshotId !==
        'string' ||
      snapshotId.trim() === ''
    ) {
      return {
        success: false,
        code: 'INVALID_SNAPSHOT',
        message:
          'ORDER DISPATCH REJECTED: snapshotId is required.',
      };
    }

    // ==============================================================
    // RULE 5 — SYMBOL
    // ==============================================================

    if (
      !symbol ||
      typeof symbol !== 'string' ||
      symbol.trim() === ''
    ) {
      return {
        success: false,
        code: 'INVALID_SYMBOL',
        message:
          'ORDER DISPATCH REJECTED: Symbol is invalid.',
      };
    }

    // ==============================================================
    // RULE 6 — SIDE
    // ==============================================================

    if (
      side !== 'BUY' &&
      side !== 'SELL'
    ) {
      return {
        success: false,
        code: 'INVALID_SIDE',
        message:
          'ORDER DISPATCH REJECTED: Order side must be BUY or SELL.',
      };
    }

    // ==============================================================
    // RULE 7 — LOT
    // ==============================================================

    const numericLot =
      Number(lot);

    if (
      Number.isNaN(numericLot) ||
      numericLot <= 0
    ) {
      return {
        success: false,
        code: 'INVALID_LOT',
        message:
          'ORDER DISPATCH REJECTED: lot must be greater than 0.',
      };
    }

    // ==============================================================
    // RULE 8 — ENTRY
    // ==============================================================

    const numEntry =
      Number(entryPrice);

    if (
      Number.isNaN(numEntry) ||
      numEntry <= 0
    ) {
      return {
        success: false,
        code:
          'INVALID_ENTRY_PRICE',

        message:
          'ORDER DISPATCH REJECTED: Entry price must be greater than 0.',
      };
    }

    // ==============================================================
    // RULE 9 — STOP LOSS
    // ==============================================================

    const numSL =
      Number(stopLoss);

    if (
      Number.isNaN(numSL) ||
      numSL <= 0
    ) {
      return {
        success: false,
        code:
          'INVALID_STOP_LOSS',

        message:
          'ORDER DISPATCH REJECTED: Stop Loss must be greater than 0.',
      };
    }

    // ==============================================================
    // RULE 10 — TP1
    // ==============================================================

    const numTP1 =
      Number(takeProfit1);

    if (
      Number.isNaN(numTP1) ||
      numTP1 <= 0
    ) {
      return {
        success: false,
        code:
          'INVALID_TAKE_PROFIT',

        message:
          'ORDER DISPATCH REJECTED: TP1 must be greater than 0.',
      };
    }

    // ==============================================================
    // RULE 11 — BUY STRUCTURE
    // ==============================================================

    if (side === 'BUY') {
      if (numSL >= numEntry) {
        return {
          success: false,
          code: 'INVALID_BUY_SL',

          message:
            `ORDER DISPATCH REJECTED: ` +
            `For BUY, SL (${numSL}) must be below Entry (${numEntry}).`,
        };
      }

      if (numEntry >= numTP1) {
        return {
          success: false,
          code:
            'INVALID_BUY_TP',

          message:
            `ORDER DISPATCH REJECTED: ` +
            `For BUY, TP1 (${numTP1}) must be above Entry (${numEntry}).`,
        };
      }
    }

    // ==============================================================
    // RULE 12 — SELL STRUCTURE
    // ==============================================================

    if (side === 'SELL') {
      if (numTP1 >= numEntry) {
        return {
          success: false,
          code:
            'INVALID_SELL_TP',

          message:
            `ORDER DISPATCH REJECTED: ` +
            `For SELL, TP1 (${numTP1}) must be below Entry (${numEntry}).`,
        };
      }

      if (numEntry >= numSL) {
        return {
          success: false,
          code:
            'INVALID_SELL_SL',

          message:
            `ORDER DISPATCH REJECTED: ` +
            `For SELL, SL (${numSL}) must be above Entry (${numEntry}).`,
        };
      }
    }

    // ==============================================================
    // CONSTRUCT ORDER
    // ==============================================================

    const now =
      new Date().toISOString();

    const order:
      TradeExecutionOrder = {
      signalId:
        cleanSignalId,

      snapshotId:
        String(snapshotId),

      // ============================================================
      // MULTI USER ROUTING
      // ============================================================

      userId:
        cleanUserId,

      tradingAccountId:
        cleanTradingAccountId,

      accountId:
        cleanAccountId,

      accountNumber:
        cleanAccountNumber,

      targetWorkerId:
        cleanTargetWorkerId,

      // ============================================================
      // TRADE DATA
      // ============================================================

      symbol:
        symbol
          .trim()
          .toUpperCase(),

      side,

      orderType:
        orderType as
          | 'MARKET'
          | 'LIMIT'
          | 'STOP',

      lot:
        Number(
          numericLot.toFixed(2),
        ),

      capturePrice:
        capturePrice !==
        undefined
          ? Number(
              Number(
                capturePrice,
              ).toFixed(3),
            )
          : Number(
              numEntry.toFixed(3),
            ),

      entryPrice:
        Number(
          numEntry.toFixed(3),
        ),

      stopLoss:
        Number(
          numSL.toFixed(3),
        ),

      takeProfit1:
        Number(
          numTP1.toFixed(3),
        ),

      takeProfit2:
        takeProfit2 !==
          null &&
        takeProfit2 !==
          undefined
          ? Number(
              Number(
                takeProfit2,
              ).toFixed(3),
            )
          : null,

      riskPercent:
        Number(
          Number(
            riskPercent,
          ).toFixed(2),
        ),

      estimatedLoss:
        Number(
          Number(
            estimatedLoss,
          ).toFixed(2),
        ),

      confidence:
        Number(confidence),

      tradingStyle:
        (
          tradingStyle ||
          'INTRADAY'
        ) as
          | 'SCALPING'
          | 'INTRADAY',

      timeframe:
        String(
          timeframe || 'H1',
        ),

      // ============================================================
      // EXECUTION LIFECYCLE
      // ============================================================

      status: 'PENDING',

      riskValidation:
        'PASS',

      claimedAt: null,

      claimedBy: null,

      processedAt: null,

      executedAt: null,

      mt5Ticket: null,

      fillPrice: null,

      executedLot: null,

      errorCode: null,

      errorMessage: null,

      createdAt: now,

      updatedAt: now,
    };

    // ==============================================================
    // REGISTER
    // ==============================================================

    this.dispatchedSignals.add(
      cleanSignalId,
    );

    // newest masuk depan
    this.queue.unshift(order);

    console.log(
      '[MT5 BRIDGE ENQUEUE]',
      {
        signalId:
          order.signalId,

        userId:
          order.userId,

        tradingAccountId:
          order.tradingAccountId,

        accountNumber:
          order.accountNumber,

        targetWorkerId:
          order.targetWorkerId,

        accountId:
          order.accountId,

        symbol:
          order.symbol,

        side:
          order.side,

        lot:
          order.lot,

        status:
          order.status,
      },
    );

    return {
      success: true,
      code:
        'ORDER_DISPATCHED',

      message:
        'ORDER DISPATCHED ✓',

      order,
    };
  }

  // ================================================================
  // 2. CLAIM NEXT ORDER
  // ================================================================

  public claimNextOrder(
    claimedBy =
      'MT5_EA_WORKER_1',

    accountNumber?: string,
  ): {
    success: boolean;
    code: string;
    message: string;
    order?:
      | TradeExecutionOrder
      | null;
  } {
    this.checkClaimTimeouts();

    const worker =
      String(
        claimedBy || '',
      ).trim();

    if (!worker) {
      return {
        success: false,
        code:
          'WORKER_ID_REQUIRED',

        message:
          'Worker ID is required.',

        order: null,
      };
    }

    const cleanAccountNumber =
      accountNumber
        ? String(
            accountNumber,
          ).trim()
        : undefined;

    // ==============================================================
    // FIFO:
    // Queue dibuat menggunakan unshift.
    // Jadi cari dari belakang.
    //
    // IMPORTANT ROUTING:
    //
    // 1. Jika order punya targetWorkerId:
    //      hanya worker yang cocok boleh claim.
    //
    // 2. Jika targetWorkerId belum ada:
    //      dianggap legacy order dan tetap boleh diclaim.
    //
    // Ini menjaga EA existing tetap bekerja selama migrasi.
    // ==============================================================

    let actualIndex = -1;

    for (
      let i =
        this.queue.length - 1;
      i >= 0;
      i--
    ) {
      const order =
        this.queue[i];

      if (
        order.status !==
        'PENDING'
      ) {
        continue;
      }

      // ============================================================
      // WORKER ROUTING
      // ============================================================

      if (
        order.targetWorkerId &&
        order.targetWorkerId !==
          worker
      ) {
        continue;
      }

      // ============================================================
      // ACCOUNT ROUTING
      // ============================================================

      if (
        cleanAccountNumber &&
        order.accountNumber &&
        order.accountNumber !==
          cleanAccountNumber
      ) {
        continue;
      }

      actualIndex = i;
      break;
    }

    if (actualIndex === -1) {
      return {
        success: false,

        code:
          'NO_PENDING_ORDERS',

        message:
          `No pending order available for worker ${worker}.`,

        order: null,
      };
    }

    const targetOrder =
      this.queue[
        actualIndex
      ];

    // ==============================================================
    // ATOMIC CLAIM
    // ==============================================================

    targetOrder.status =
      'CLAIMED';

    targetOrder.claimedAt =
      new Date().toISOString();

    targetOrder.claimedBy =
      worker;

    targetOrder.updatedAt =
      new Date().toISOString();

    console.log(
      '[MT5 BRIDGE CLAIM]',
      {
        signalId:
          targetOrder.signalId,

        worker,

        accountNumber:
          targetOrder.accountNumber,

        targetWorkerId:
          targetOrder.targetWorkerId,
      },
    );

    return {
      success: true,

      code:
        'ORDER_CLAIMED',

      message:
        `Order ${targetOrder.signalId} claimed successfully by ${worker}`,

      order:
        targetOrder,
    };
  }

  // ================================================================
  // 3. MARK PROCESSING
  // ================================================================

  public markOrderProcessing(
    signalId: string,
    claimedBy?: string,
  ): {
    success: boolean;
    code: string;
    message: string;
    order?: TradeExecutionOrder;
  } {
    if (
      !signalId ||
      typeof signalId !==
        'string'
    ) {
      return {
        success: false,

        code:
          'INVALID_SIGNAL_ID',

        message:
          'Valid signalId is required.',
      };
    }

    const cleanSignalId =
      signalId.trim();

    const order =
      this.queue.find(
        (o) =>
          o.signalId ===
          cleanSignalId,
      );

    if (!order) {
      return {
        success: false,

        code:
          'ORDER_NOT_FOUND',

        message:
          `Order ${cleanSignalId} was not found.`,
      };
    }

    // ==============================================================
    // TERMINAL STATE
    // ==============================================================

    if (
      order.status ===
        'EXECUTED' ||
      order.status ===
        'REJECTED' ||
      order.status ===
        'FAILED'
    ) {
      return {
        success: false,

        code:
          'INVALID_TRANSITION',

        message:
          `Order ${cleanSignalId} is already ${order.status}.`,
      };
    }

    const worker =
      claimedBy
        ? claimedBy.trim()
        : undefined;

    // ==============================================================
    // WORKER OWNERSHIP VALIDATION
    // ==============================================================

    if (
      worker &&
      order.claimedBy &&
      worker !==
        order.claimedBy
    ) {
      return {
        success: false,

        code:
          'WORKER_MISMATCH',

        message:
          `Order ${cleanSignalId} is owned by worker ${order.claimedBy}, not ${worker}.`,
      };
    }

    if (
      worker &&
      order.targetWorkerId &&
      worker !==
        order.targetWorkerId
    ) {
      return {
        success: false,

        code:
          'TARGET_WORKER_MISMATCH',

        message:
          `Worker ${worker} is not authorized for order ${cleanSignalId}.`,
      };
    }

    order.status =
      'PROCESSING';

    order.processedAt =
      new Date().toISOString();

    order.updatedAt =
      new Date().toISOString();

    if (worker) {
      order.claimedBy =
        worker;
    }

    console.log(
      `[MT5 BRIDGE PROCESSING] ${cleanSignalId} worker=${order.claimedBy}`,
    );

    return {
      success: true,

      code:
        'ORDER_PROCESSING',

      message:
        `Order ${cleanSignalId} is now PROCESSING.`,

      order,
    };
  }

  // ================================================================
  // 4. RECORD EXECUTION RESULT
  // ================================================================

  public recordOrderResult(
    payload: {
      signalId: string;

      status:
        TradeOrderStatus;

      claimedBy?: string;

      mt5Ticket?:
        | string
        | number;

      fillPrice?: number;

      executedLot?: number;

      errorCode?: string;

      errorMessage?: string;
    },
  ): {
    success: boolean;
    code: string;
    message: string;
    order?: TradeExecutionOrder;
  } {
    const {
      signalId,

      status,

      claimedBy,

      mt5Ticket,

      fillPrice,

      executedLot,

      errorCode,

      errorMessage,
    } = payload;

    if (
      !signalId ||
      typeof signalId !==
        'string'
    ) {
      return {
        success: false,

        code:
          'INVALID_SIGNAL_ID',

        message:
          'Valid signalId is required.',
      };
    }

    const cleanSignalId =
      signalId.trim();

    const order =
      this.queue.find(
        (o) =>
          o.signalId ===
          cleanSignalId,
      );

    if (!order) {
      return {
        success: false,

        code:
          'ORDER_NOT_FOUND',

        message:
          `Order ${cleanSignalId} was not found.`,
      };
    }

    // ==============================================================
    // OPTIONAL WORKER VALIDATION
    //
    // claimedBy dibuat optional agar EA v2.20 existing
    // tetap kompatibel.
    //
    // EA v2.30 nanti wajib mengirim claimedBy.
    // ==============================================================

    if (
      claimedBy &&
      order.claimedBy &&
      claimedBy !==
        order.claimedBy
    ) {
      return {
        success: false,

        code:
          'WORKER_MISMATCH',

        message:
          `Worker ${claimedBy} cannot update order owned by ${order.claimedBy}.`,
      };
    }

    // ==============================================================
    // INVALID BACKWARD TRANSITION
    // ==============================================================

    if (
      order.status ===
        'EXECUTED' ||
      order.status ===
        'REJECTED' ||
      order.status ===
        'FAILED'
    ) {
      if (
        status ===
          'PROCESSING' ||
        status ===
          'CLAIMED' ||
        status ===
          'PENDING'
      ) {
        return {
          success: false,

          code:
            'INVALID_TRANSITION',

          message:
            `Order ${cleanSignalId} cannot revert from ${order.status} to ${status}.`,
        };
      }
    }

    order.status =
      status;

    order.updatedAt =
      new Date().toISOString();

    // ==============================================================
    // EXECUTED
    // ==============================================================

    if (status === 'EXECUTED') {
      order.mt5Ticket =
        mt5Ticket
          ? String(
              mt5Ticket,
            )
          : `TKT-${Math.floor(
              100000000 +
                Math.random() *
                  900000000,
            )}`;

      order.fillPrice =
        fillPrice !==
        undefined
          ? Number(fillPrice)
          : order.entryPrice;

      order.executedLot =
        executedLot !==
        undefined
          ? Number(
              executedLot,
            )
          : order.lot;

      order.executedAt =
        new Date().toISOString();

      order.errorCode = null;

      order.errorMessage =
        null;

      console.log(
        '[MT5 BRIDGE EXECUTED]',
        {
          signalId:
            cleanSignalId,

          worker:
            order.claimedBy,

          accountNumber:
            order.accountNumber,

          ticket:
            order.mt5Ticket,

          fill:
            order.fillPrice,

          lot:
            order.executedLot,
        },
      );
    }

    // ==============================================================
    // REJECTED / FAILED
    // ==============================================================

    else if (
      status ===
        'REJECTED' ||
      status === 'FAILED'
    ) {
      order.errorCode =
        errorCode ||
        (
          status ===
          'REJECTED'
            ? 'BROKER_REJECTED'
            : 'EXECUTION_FAILED'
        );

      order.errorMessage =
        errorMessage ||
        'Order was rejected during MT5 execution.';

      console.warn(
        '[MT5 BRIDGE FAILED]',
        {
          signalId:
            cleanSignalId,

          worker:
            order.claimedBy,

          status,

          errorCode:
            order.errorCode,

          errorMessage:
            order.errorMessage,
        },
      );
    }

    // ==============================================================
    // PROCESSING
    // ==============================================================

    else if (
      status ===
      'PROCESSING'
    ) {
      order.processedAt =
        new Date().toISOString();
    }

    return {
      success: true,

      code:
        'RESULT_RECORDED',

      message:
        `Order ${cleanSignalId} status updated to ${status}.`,

      order,
    };
  }

  // ================================================================
  // 5. PENDING ORDERS
  // ================================================================

  public getPendingOrders(
    targetWorkerId?: string,
  ): TradeExecutionOrder[] {
    this.checkClaimTimeouts();

    if (!targetWorkerId) {
      return this.queue.filter(
        (order) =>
          order.status ===
          'PENDING',
      );
    }

    return this.queue.filter(
      (order) =>
        order.status ===
          'PENDING' &&
        (
          !order.targetWorkerId ||
          order.targetWorkerId ===
            targetWorkerId
        ),
    );
  }

  // ================================================================
  // 6. GET ALL
  // ================================================================

  public getAllOrders():
    TradeExecutionOrder[] {
    this.checkClaimTimeouts();

    return this.queue;
  }

  // ================================================================
  // 7. FIND SIGNAL
  // ================================================================

  public getOrderBySignalId(
    signalId: string,
  ):
    | TradeExecutionOrder
    | undefined {
    return this.queue.find(
      (o) =>
        o.signalId ===
        signalId.trim(),
    );
  }

  // ================================================================
  // 8. FIND USER ORDERS
  // ================================================================

  public getOrdersByUserId(
    userId: string,
  ):
    TradeExecutionOrder[] {
    const clean =
      userId.trim();

    return this.queue.filter(
      (o) =>
        o.userId === clean,
    );
  }

  // ================================================================
  // 9. FIND ACCOUNT ORDERS
  // ================================================================

  public getOrdersByTradingAccountId(
    tradingAccountId: string,
  ):
    TradeExecutionOrder[] {
    const clean =
      tradingAccountId.trim();

    return this.queue.filter(
      (o) =>
        o.tradingAccountId ===
        clean,
    );
  }

  // ================================================================
  // 10. DUPLICATE CHECK
  // ================================================================

  public isSignalDispatched(
    signalId: string,
  ): boolean {
    return this.dispatchedSignals.has(
      signalId.trim(),
    );
  }

  // ================================================================
  // 11. DEVELOPMENT CLEAR
  // ================================================================

  public clearQueue(): void {
    this.queue = [];

    this.dispatchedSignals.clear();
  }
}

export const tradeService =
  new TradeService();