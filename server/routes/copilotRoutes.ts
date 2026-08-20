import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { copilotService } from '../services/copilotService.js';
import { symbolService } from '../services/symbolService.js';
import { tradeValidationEngine } from '../engines/tradeValidationEngine.js';
import { positionSizingEngine } from '../engines/positionSizingEngine.js';
import { marketDataService } from '../services/marketDataService.js';
import { creditService } from '../services/creditService.js';

export const copilotRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'spilla_gold_institutional_jwt_secret_2026';

function extractUserId(req: any): string {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      if (decoded?.userId) return decoded.userId;
    }
  } catch {}
  if (req.body?.userId) return req.body.userId;
  return 'usr-trader-002'; // Default fallback trader for demo
}

/**
 * GET /api/copilot/symbols
 * Returns list of supported broker symbols with complete specifications.
 */
copilotRouter.get('/symbols', (_req, res) => {
  try {
    const symbols = symbolService.getAllSymbols();
    res.json({
      success: true,
      symbols,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/copilot/config
 * Returns centralized Copilot configuration.
 */
copilotRouter.get('/config', (_req, res) => {
  try {
    const config = tradeValidationEngine.getConfig();
    res.json({
      success: true,
      config,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/copilot/config
 * Updates centralized Copilot risk and validator parameters.
 */
copilotRouter.post('/config', (req, res) => {
  try {
    const updated = tradeValidationEngine.updateConfig(req.body || {});
    res.json({
      success: true,
      message: 'Copilot configuration updated',
      config: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/copilot/analyze
 * "CAPTURE NOW" Pipeline: Multi-engine analysis + Gemini AI + Position Sizing + Deterministic NO_TRADE Validation.
 */
copilotRouter.post('/analyze', async (req, res) => {
  const userId = extractUserId(req);
  const {
    symbol,
    timeframe,
    equity,
    riskPercent,
    mode,
    fixedLot,
    fixedRiskAmount,
    chartImageBase64,
    capturePrice,
    chartRunningPrice,
    captureId,
    captureVersion,
    bid,
    ask,
    mid,
    timestamp,
    indicators,
    tradingStyle,
  } = req.body || {};

  try {
    // 1. Mandatory Credit Pre-Check (1 Live Analysis = 100 Credit = Rp100)
    const creditCheck = await creditService.checkCanAnalyze(userId, 100);
    if (!creditCheck.canAnalyze) {
      return res.status(402).json({
        success: false,
        error: 'INSUFFICIENT_CREDIT',
        message: `Saldo SPILLA AI Credit Anda tidak mencukupi untuk melakukan Live Analysis AI (Sisa saldo: ${creditCheck.currentBalance.toLocaleString('id-ID')} Credit, Dibutuhkan: 100 Credit). Silakan Top Up terlebih dahulu.`,
        currentBalance: creditCheck.currentBalance,
        requiredCredit: creditCheck.required,
        availableAnalysis: creditCheck.availableAnalysis,
      });
    }

    // 2. Perform AI Copilot Multi-Engine Analysis
    const snapshot = await copilotService.captureAndAnalyze({
      symbol: symbol || 'XAUUSD',
      timeframe: timeframe || 'H1',
      tradingStyle: tradingStyle || 'INTRADAY',
      equity: equity ? Number(equity) : 10000,
      riskPercent: riskPercent ? Number(riskPercent) : 1.0,
      mode: mode || 'RISK_PERCENT',
      fixedLot: fixedLot ? Number(fixedLot) : undefined,
      fixedRiskAmount: fixedRiskAmount ? Number(fixedRiskAmount) : undefined,
      chartImageBase64,
      capturePrice: capturePrice ? Number(capturePrice) : undefined,
      chartRunningPrice: chartRunningPrice ? Number(chartRunningPrice) : undefined,
      captureId,
      captureVersion: captureVersion ? Number(captureVersion) : undefined,
      bid: bid ? Number(bid) : undefined,
      ask: ask ? Number(ask) : undefined,
      mid: mid ? Number(mid) : undefined,
      timestamp,
      indicators: Array.isArray(indicators) && indicators.length > 0 ? indicators : undefined,
    });

    // 3. Analysis succeeded: Deduct 100 Credit atomically & create ledger
    let deductResult: any = null;
    try {
      deductResult = await creditService.deductForAnalysis(userId, {
        symbol: symbol || 'XAUUSD',
        timeframe: timeframe || 'H1',
        analysisType: 'LIVE_AI_ANALYSIS',
        snapshotId: snapshot.captureId,
      });
    } catch (deductErr: any) {
      console.error('[Credit Deduction Error]', deductErr);
    }

    res.json({
      success: true,
      captureId: snapshot.captureId,
      captureVersion: snapshot.captureVersion,
      capturePrice: snapshot.capturePrice,
      currentPrice: snapshot.capturePrice,
      anchor: snapshot.capturePrice,
      anchorPrice: snapshot.capturePrice,
      captureTimestamp: snapshot.captureTimestamp,
      credit: {
        cost: 100,
        remainingBalance: deductResult?.newBalance ?? creditCheck.currentBalance - 100,
        transactionId: deductResult?.transactionId,
        analysisId: deductResult?.analysisId,
      },
      market: {
        bid: snapshot.bid,
        ask: snapshot.ask,
        mid: snapshot.capturePrice || snapshot.market_price_at_creation,
      },
      tradePlan: {
        entry_price: snapshot.trade_plan.entry_price,
        stop_loss: snapshot.trade_plan.stop_loss,
        take_profit_1: snapshot.trade_plan.take_profit_1,
        take_profit_2: snapshot.trade_plan.take_profit_2,
      },
      snapshot,
    });
  } catch (err: any) {
    console.error('[Copilot Router Error] Failed to analyze:', err?.message || err);

    // Record failed analysis without deducting user's credit
    try {
      await creditService.recordFailedAnalysis(userId, {
        symbol: symbol || 'XAUUSD',
        timeframe: timeframe || 'H1',
        error: err?.message || 'Unknown error',
      });
    } catch {}

    res.status(400).json({
      success: false,
      error: 'ANALYSIS_FAILED',
      message: err?.message || 'Failed to analyze chart capture.',
    });
  }
});


/**
 * GET /api/copilot/active-plan
 * Retrieves the current immutable Trade Plan Snapshot and Real-time Live Market State.
 */
copilotRouter.get('/active-plan', async (_req, res) => {
  try {
    const snapshot = copilotService.getActiveSnapshot();
    const liveMarketState = marketDataService.getLiveMarketState();

    res.json({
      success: true,
      snapshot: snapshot || null,
      liveMarket: liveMarketState,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/copilot/validate-plan
 * Re-validates position sizing and risk parameters on equity or mode changes.
 */
copilotRouter.post('/validate-plan', (req, res) => {
  try {
    const { symbol, equity, mode, riskPercent, fixedLot, fixedRiskAmount, entryPrice, stopLoss } = req.body || {};
    const activeSnapshot = copilotService.getActiveSnapshot();

    const sym = symbol || activeSnapshot?.symbol || 'XAUUSD';
    const entry = entryPrice ?? activeSnapshot?.trade_plan.entry_price ?? marketDataService.getCurrentPrice();
    const sl = stopLoss ?? activeSnapshot?.trade_plan.stop_loss ?? (entry - 15);

    const posSizing = positionSizingEngine.calculate(
      {
        symbol: sym,
        accountEquity: equity ? Number(equity) : 10000,
        mode: mode || 'RISK_PERCENT',
        riskPercent: riskPercent ? Number(riskPercent) : 1.0,
        fixedLot: fixedLot ? Number(fixedLot) : undefined,
        fixedRiskAmount: fixedRiskAmount ? Number(fixedRiskAmount) : undefined,
        entryPrice: entry,
        stopLoss: sl,
      },
      tradeValidationEngine.getConfig().MAX_RISK_PERCENT
    );

    res.json({
      success: true,
      positionSizing: posSizing,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/copilot/lock-plan
 * Manually locks the dynamic trade plan at current live price or specified entry.
 */
copilotRouter.post('/lock-plan', (req, res) => {
  try {
    const { price } = req.body || {};
    const lockedSnapshot = copilotService.lockActiveTradePlan(price ? Number(price) : undefined);
    res.json({
      success: true,
      message: 'Dynamic Trade Plan successfully locked as Execution Plan',
      snapshot: lockedSnapshot,
      mode: 'LOCKED',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/copilot/unlock-plan
 * Returns locked trade plan back to continuous DYNAMIC tracking mode.
 */
copilotRouter.post('/unlock-plan', (_req, res) => {
  try {
    const dynamicSnapshot = copilotService.unlockActiveTradePlan();
    res.json({
      success: true,
      message: 'Trade Plan returned to DYNAMIC LIVE tracking mode',
      snapshot: dynamicSnapshot,
      mode: 'DYNAMIC',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/copilot/execute
 * Safe Idempotent Execution with Final Live Re-check & User Confirmation.
 */
copilotRouter.post('/execute', async (req, res) => {
  try {
    const { idempotency_key, trade_plan_id, symbol, action, volume, entry_price, stop_loss, take_profit, user_confirmed } = req.body || {};

    if (!user_confirmed) {
      return res.status(400).json({
        success: false,
        code: 'USER_CONFIRMATION_REQUIRED',
        message: 'Explicit user confirmation is mandatory before order execution.',
      });
    }

    const response = await copilotService.executeTradePlan({
      idempotency_key: idempotency_key || `IDEMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      trade_plan_id,
      symbol: symbol || 'XAUUSD',
      action: action || 'BUY',
      volume: volume ? Number(volume) : 0.01,
      entry_price: Number(entry_price),
      stop_loss: Number(stop_loss),
      take_profit: Number(take_profit),
      user_confirmed: Boolean(user_confirmed),
    });

    res.json(response);
  } catch (err: any) {
    console.error('[Copilot Execute Error]:', err);
    res.status(500).json({
      success: false,
      code: 'EXECUTION_INTERNAL_ERROR',
      message: err?.message || 'Failed to process trade execution request',
    });
  }
});

/**
 * POST /api/copilot/set-price
 * Manually or automatically anchor the live price to match chart price line with 100% precision.
 */
copilotRouter.post('/set-price', (req, res) => {
  try {
    const { price, symbol } = req.body || {};
    const numericPrice = Number(price);
    if (!numericPrice || isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ success: false, error: 'Valid price number required' });
    }
    marketDataService.updatePriceFromProvider(numericPrice, 'USER_CHART_SYNC');
    res.json({
      success: true,
      price: numericPrice,
      symbol: symbol || 'XAUUSD',
      liveMarket: marketDataService.getLiveMarketState(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

