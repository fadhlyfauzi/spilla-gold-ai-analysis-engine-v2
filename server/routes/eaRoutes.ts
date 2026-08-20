import { Router } from 'express';
import { recommendationEngine } from '../engines/recommendationEngine.js';
import { mt5AiService } from '../services/mt5AiService.js';
import { marketDataService } from '../services/marketDataService.js';
import { copilotService } from '../services/copilotService.js';
import { db } from '../db/database.js';

export const eaRouter = Router();

/**
 * POST /api/ea/mt5-data or /api/mt5-data
 * Ingest MT5 EA JSON Payload (XAUUSD.cent) and invoke Google AI Studio (Gemini API) Analysis.
 */
eaRouter.post(['/', '/mt5-data', '/payload', '/tick', '/ingest'], async (req, res) => {
  try {
    const payload = req.body || {};
    
    // Update MarketDataService single source of truth directly from MT5
    const rawPrice = payload.current_price !== undefined ? Number(payload.current_price) : (payload.price !== undefined ? Number(payload.price) : (payload.candles && payload.candles[0]?.close !== undefined ? Number(payload.candles[0].close) : (payload.bid && payload.ask ? (Number(payload.bid) + Number(payload.ask)) / 2 : undefined)));
    const rawBid = payload.bid !== undefined ? Number(payload.bid) : (payload.indicators?.s1 !== undefined ? Number(payload.indicators.s1) : (rawPrice ? rawPrice - 0.20 : undefined));
    const rawAsk = payload.ask !== undefined ? Number(payload.ask) : (payload.indicators?.r1 !== undefined ? Number(payload.indicators.r1) : (rawPrice ? rawPrice + 0.20 : undefined));
    const rawSpread = payload.spread !== undefined ? Number(payload.spread) : (rawBid && rawAsk ? Number((rawAsk - rawBid).toFixed(2)) : 0.40);
    const rawSymbol = payload.symbol || 'XAUUSD';

    if (rawPrice !== undefined && rawPrice > 0) {
      marketDataService.updateFromMt5Quote({
        symbol: rawSymbol,
        price: rawPrice,
        bid: rawBid,
        ask: rawAsk,
        spread: rawSpread,
        candles: payload.candles,
      });

      console.log("[MT5 → MARKET DATA]", {
        bid: rawBid,
        ask: rawAsk,
        mid: rawPrice,
        timestamp: new Date().toISOString(),
        source: "MT5",
        isLive: true
      });

      console.log("[MARKET DATA AFTER MT5 UPDATE]", marketDataService.getLiveMarketState());

      copilotService.onLivePriceUpdate(rawPrice);
    }

    const result = await mt5AiService.processMt5Payload(payload);
    const activePlan = copilotService.getActiveSnapshot();

    res.json({
      success: true,
      message: 'MT5 payload processed and synchronized with authoritative Trade Plan',
      mt5Data: result.mt5Data,
      analysis: result.analysis,
      activePlan,
      activeSignal: db.getActiveSignal(),
    });
  } catch (error: any) {
    console.error('[EA Route Error] Failed to process MT5 payload:', error);
    res.status(500).json({
      success: false,
      error: 'MT5_PAYLOAD_PROCESSING_FAILED',
      message: error?.message || 'Failed to process MT5 EA payload',
    });
  }
});

/**
 * GET /api/ea/mt5-data or /api/mt5-data
 * Get latest MT5 payload, active trade plan, and Google AI Studio Gemini analysis result.
 */
eaRouter.get(['/', '/mt5-data'], async (_req, res) => {
  try {
    const mt5Data = mt5AiService.getLatestMt5Data();
    let analysis = mt5AiService.getLatestAnalysis();

    if (!analysis) {
      const processed = await mt5AiService.processMt5Payload(mt5Data);
      analysis = processed.analysis;
    }

    const activePlan = copilotService.getActiveSnapshot();

    res.json({
      success: true,
      mt5Data,
      analysis,
      activePlan,
      activeSignal: db.getActiveSignal(),
    });
  } catch (error: any) {
    console.error('[EA Route Error] Failed to retrieve MT5 data:', error);
    res.status(500).json({
      success: false,
      error: 'MT5_DATA_RETRIEVAL_FAILED',
      message: error?.message || 'Failed to retrieve MT5 data',
    });
  }
});

/**
 * POST /api/ea/trade-update or /api/ea/execution-status
 * Allows MT5 EA to post position updates, ticket numbers, planned entry vs actual fill price.
 */
eaRouter.post(['/trade-update', '/execution-status'], (req, res) => {
  try {
    const {
      planId,
      trade_plan_id,
      snapshotId,
      snapshot_id,
      signalId,
      ticket,
      mt5Ticket,
      executionStatus,
      status,
      plannedEntry,
      planned_entry,
      requestedExecutionPrice,
      requestedPrice,
      actualExecutionPrice,
      actualPrice,
      actualEntry,
      fillPrice,
      executedAt,
      closedResult,
      returnPips,
    } = req.body || {};

    const activeSig = db.getActiveSignal();
    const activePlan = copilotService.getActiveSnapshot();
    const targetSignalId = signalId || activeSig?.signalId || '';
    const targetPlanId = planId || trade_plan_id || activePlan?.trade_plan_id || '';
    const targetSnapshotId = snapshotId || snapshot_id || activePlan?.snapshot_id || '';

    const ticketVal = ticket !== undefined ? ticket : mt5Ticket;
    const planEntryVal = plannedEntry !== undefined ? Number(plannedEntry) : (planned_entry !== undefined ? Number(planned_entry) : (activePlan?.trade_plan.entry_price ?? activeSig?.entryPrice));
    const actPrice = actualExecutionPrice !== undefined ? Number(actualExecutionPrice) : (actualEntry !== undefined ? Number(actualEntry) : (actualPrice !== undefined ? Number(actualPrice) : (fillPrice !== undefined ? Number(fillPrice) : undefined)));

    console.log(
      `\n[SPILLA][EXECUTION]\nPlan ID: ${targetPlanId}\nSnapshot ID: ${targetSnapshotId}\nPlanned Entry: ${planEntryVal}\nActual Entry: ${actPrice ?? '--'}\nStatus: ${status || executionStatus || 'EXECUTED'}\n`
    );

    const updated = db.updateSignalExecution(targetSignalId, {
      mt5Ticket: ticketVal,
      executionStatus: executionStatus || 'EXECUTED',
      status: status || 'EXECUTED',
      requestedExecutionPrice: planEntryVal,
      actualExecutionPrice: actPrice,
      executedAt: executedAt || new Date().toISOString(),
      closedResult,
      returnPips,
    });

    if (activePlan && actPrice !== undefined) {
      activePlan.status = (status as any) || 'EXECUTED';
      activePlan.actual_execution_price = actPrice;
      activePlan.actualEntry = actPrice;
      activePlan.mt5_ticket = ticketVal;
    }

    res.json({
      success: true,
      message: 'Trade execution status and actual MT5 fill price successfully recorded',
      planId: targetPlanId,
      snapshotId: targetSnapshotId,
      plannedEntry: planEntryVal,
      actualEntry: actPrice,
      signal: updated || db.getActiveSignal(),
      activePlan,
    });
  } catch (error: any) {
    console.error('[EA Route Error] Failed to process trade update:', error);
    res.status(500).json({
      success: false,
      error: 'TRADE_UPDATE_FAILED',
      message: error?.message || 'Failed to process EA trade update',
    });
  }
});

/**
 * GET /api/ea/signal
 * Authoritative API Endpoint for MetaTrader 5 (MT5) Expert Advisors (MQL5).
 * Strictly provides separate Planned Entry, Live Market Price, Snapshot ID, Plan ID, and Chart Objects.
 */
eaRouter.get('/signal', async (req, res) => {
  try {
    const symbolParam = req.query.symbol as string;
    let activePlan = copilotService.getActiveSnapshot();

    if (!activePlan) {
      // Auto-generate fresh plan if none active
      activePlan = await copilotService.captureAndAnalyze();
    }

    const currentLivePrice = marketDataService.getCurrentPrice();
    const liveMarket = marketDataService.getLiveMarket();
    const activeSig = db.getActiveSignal();

    const symbol = symbolParam ? symbolParam.trim() : (activePlan?.symbol || 'XAUUSD');
    const planId = activePlan.trade_plan_id;
    const snapshotId = activePlan.snapshot_id || `SNAP-${Date.now()}`;
    const plannedEntry = activePlan.trade_plan.entry_price;
    const stopLoss = activePlan.trade_plan.stop_loss;
    const takeProfit1 = activePlan.trade_plan.take_profit_1;
    const takeProfit2 = activePlan.trade_plan.take_profit_2;
    const takeProfit3 = activePlan.trade_plan.take_profit_3 || Number((plannedEntry + (plannedEntry - stopLoss) * 3).toFixed(2));
    const riskRewardRatio = activePlan.trade_plan.risk_reward_ratio;
    const direction = activePlan.action === 'BUY' ? 'BUY' : (activePlan.action === 'SELL' ? 'SELL' : 'WAIT');

    const chartObjects = {
      entry: `SPILLA_ENTRY_${planId}`,
      sl: `SPILLA_SL_${planId}`,
      tp1: `SPILLA_TP1_${planId}`,
      tp2: `SPILLA_TP2_${planId}`,
    };

    console.log(
      `\n[SPILLA][EA SIGNAL SERVED]\nPlan ID: ${planId}\nSnapshot ID: ${snapshotId}\nPlanned Entry: ${plannedEntry}\nCurrent Live Price: ${currentLivePrice}\nSL: ${stopLoss}\nTP1: ${takeProfit1}\nTP2: ${takeProfit2}\nStatus: ${activePlan.status}\n`
    );

    res.json({
      success: true,
      planId,
      snapshotId,
      symbol,
      direction,
      signal: activePlan.action,
      confidence: activePlan.confidence,
      // Strictly separated 3 prices
      plannedEntry,
      currentPrice: currentLivePrice,
      bid: liveMarket.bid,
      ask: liveMarket.ask,
      spread: liveMarket.spread,
      anchorPrice: activePlan.market_price_at_creation,
      priceDrift: activePlan.price_drift ?? Number((currentLivePrice - activePlan.market_price_at_creation).toFixed(2)),
      planAgeSeconds: activePlan.plan_age_seconds ?? 0,
      actualEntry: activePlan.actual_execution_price ?? activeSig?.actualExecutionPrice ?? null,
      // Target levels
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      riskRewardRatio,
      riskPercent: activePlan.position_sizing.risk_percent,
      suggestedLotSize: activePlan.position_sizing.normalized_lot,
      status: activePlan.status,
      executionStatus: activeSig?.executionStatus || (activePlan.status === 'EXECUTED' ? 'EXECUTED' : 'NONE'),
      mt5Ticket: activePlan.mt5_ticket ?? activeSig?.mt5Ticket ?? null,
      chartObjects,
      createdAt: activePlan.createdAt,
      expiresAt: activePlan.expiresAt,
    });
  } catch (error: any) {
    console.error('[EA Route Error] Failed to generate EA signal:', error);
    res.status(500).json({
      success: false,
      error: 'EA_SIGNAL_GENERATION_FAILED',
      message: error?.message || 'Failed to generate recommendation signal for EA',
    });
  }
});

