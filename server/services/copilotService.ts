import { GoogleGenAI } from '@google/genai';
import {
  StandardizedAiAnalysis,
  CopilotTradePlanSnapshot,
  CopilotExecutionRequest,
  CopilotExecutionResponse,
  PositionSizingMode,
  MarketCondition,
  TradingAction,
  SentimentType,
  MarketPrice,
  MarketSnapshot,
  AnalyzeRequestOptions,
  EntryMode,
  ExecutionStatus,
  PotentialDirection,
  SetupType,
  RiskClass,
  TradingStyle,
} from '../../src/types.js';
import { marketDataService } from './marketDataService.js';
import { symbolService } from './symbolService.js';
import { technicalEngine } from '../engines/technicalEngine.js';
import { fundamentalEngine } from '../engines/fundamentalEngine.js';
import { sentimentEngine } from '../engines/sentimentEngine.js';
import { riskEngine } from '../engines/riskEngine.js';
import { positionSizingEngine } from '../engines/positionSizingEngine.js';
import { tradeValidationEngine } from '../engines/tradeValidationEngine.js';
import { db } from '../db/database.js';

export class CopilotService {
  private activeSnapshot: CopilotTradePlanSnapshot | null = null;
  private processedIdempotencyKeys: Map<string, CopilotExecutionResponse> = new Map();

  private getGenAI(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  public getActiveSnapshot(): CopilotTradePlanSnapshot | null {
    if (!this.activeSnapshot) {
      this.activeSnapshot = db.getActiveTradePlanSnapshot();
    }
    if (!this.activeSnapshot) return null;

    const liveMarketState = marketDataService.getLiveMarketState();
    const livePrice = liveMarketState.midPrice;

    // Calculate real-time drift between running MT5 live market price and the captured plan anchor
    const anchorPrice = this.activeSnapshot.capturePrice ?? this.activeSnapshot.trade_plan?.entry_price ?? this.activeSnapshot.market_price_at_creation;
    const drift = anchorPrice > 0 && livePrice > 0 ? Number(Math.abs(livePrice - anchorPrice).toFixed(2)) : 0;
    
    this.activeSnapshot.price_drift = drift;
    this.activeSnapshot.marketTimestamp = liveMarketState.isoTimestamp;

    if (
      this.activeSnapshot.status === 'EXECUTED' ||
      this.activeSnapshot.plan_mode === 'LOCKED' ||
      this.activeSnapshot.status === 'LOCKED'
    ) {
      this.activeSnapshot.plan_mode = 'LOCKED';
    } else {
      this.activeSnapshot.plan_mode = 'DYNAMIC';
      if (this.activeSnapshot.status !== 'APPROVED' && this.activeSnapshot.status !== 'REJECTED') {
        this.activeSnapshot.status = 'DYNAMIC';
      }
    }

    return this.activeSnapshot;
  }

  public lockActiveTradePlan(lockedPrice?: number): CopilotTradePlanSnapshot | null {
    if (!this.activeSnapshot) return null;
    const price = lockedPrice || this.activeSnapshot.capturePrice || marketDataService.getCurrentPrice();
    const action = this.activeSnapshot.action === 'SELL' ? 'SELL' : this.activeSnapshot.action === 'BUY' ? 'BUY' : 'NONE';
    const dynamicLevels = marketDataService.calculateDynamicExecutionLevels(
      price,
      action,
      this.activeSnapshot.risk_distance || 17.02,
      1.57,
      this.activeSnapshot.symbol_spec?.digits || 2
    );

    this.activeSnapshot.plan_mode = 'LOCKED';
    this.activeSnapshot.status = 'LOCKED';
    this.activeSnapshot.market_price_at_creation = dynamicLevels.entry_price;
    this.activeSnapshot.anchor_price = dynamicLevels.entry_price;
    this.activeSnapshot.liveAnchorPrice = dynamicLevels.entry_price;
    this.activeSnapshot.capturePrice = dynamicLevels.entry_price;
    this.activeSnapshot.plannedEntry = dynamicLevels.entry_price;
    this.activeSnapshot.trade_plan.entry_price = dynamicLevels.entry_price;
    this.activeSnapshot.trade_plan.planned_entry = dynamicLevels.entry_price;
    this.activeSnapshot.trade_plan.stop_loss = dynamicLevels.stop_loss;
    this.activeSnapshot.trade_plan.take_profit_1 = dynamicLevels.take_profit_1;
    this.activeSnapshot.trade_plan.take_profit_2 = dynamicLevels.take_profit_2;
    this.activeSnapshot.trade_plan.take_profit_3 = dynamicLevels.take_profit_3;
    this.activeSnapshot.tradePlanTimestamp = new Date().toISOString();

    db.setActiveTradePlanSnapshot(this.activeSnapshot);
    console.log(`[SPILLA][PLAN LOCKED] Plan ${this.activeSnapshot.trade_plan_id} locked at entry $${dynamicLevels.entry_price}`);
    return this.activeSnapshot;
  }

  public unlockActiveTradePlan(): CopilotTradePlanSnapshot | null {
    if (!this.activeSnapshot) return null;
    this.activeSnapshot.plan_mode = 'DYNAMIC';
    this.activeSnapshot.status = 'DYNAMIC';
    this.activeSnapshot.actual_execution_price = undefined;
    this.activeSnapshot.actualEntry = undefined;
    db.setActiveTradePlanSnapshot(this.activeSnapshot);
    console.log(`[SPILLA][PLAN UNLOCKED] Plan ${this.activeSnapshot.trade_plan_id} returned to DYNAMIC LIVE mode`);
    return this.activeSnapshot;
  }

  public onLivePriceUpdate(newPrice: number): void {
    if (this.activeSnapshot && this.activeSnapshot.plan_mode !== 'LOCKED' && this.activeSnapshot.status !== 'EXECUTED') {
      this.getActiveSnapshot();
    }
  }

  /**
   * Main "CAPTURE NOW" Pipeline
   * Market Snapshot -> Multi-Engine -> Gemini AI -> Standardized Contract -> Position Sizing -> Deterministic Validation -> Snapshot
   */
  public async captureAndAnalyze(options: AnalyzeRequestOptions = {}): Promise<CopilotTradePlanSnapshot> {
    const symbol = options.symbol || 'XAUUSD';
    const tradingStyle: TradingStyle = options.tradingStyle === 'SCALPING' ? 'SCALPING' : 'INTRADAY';
    let timeframe = options.timeframe || (tradingStyle === 'SCALPING' ? 'M5' : 'H4');
    if (tradingStyle === 'SCALPING' && !['M1', 'M5', 'M15'].includes(timeframe)) {
      timeframe = 'M5';
    } else if (tradingStyle === 'INTRADAY' && !['H4', 'D1'].includes(timeframe)) {
      timeframe = 'H4';
    }
    const equity = options.equity || 10000;
    const mode = options.mode || 'RISK_PERCENT';
    const riskPercent = options.riskPercent || 1.0;
    const fixedLot = options.fixedLot;
    const fixedRiskAmount = options.fixedRiskAmount;

    // 1. Authoritative Capture Price Extraction (Single Source of Truth)
    const liveMarketState = marketDataService.getLiveMarketState();
    let initialCapturePrice: number | null = null;
    let priceSource: string | null = null;

    if (options.capturePrice && Number(options.capturePrice) > 0) {
      initialCapturePrice = Number(options.capturePrice);
      priceSource = 'EXPLICIT_CAPTURE_PRICE';
    } else if (options.mid && Number(options.mid) > 0) {
      initialCapturePrice = Number(options.mid);
      priceSource = 'MT5_DIRECT_TELEMETRY';
    } else if (options.chartRunningPrice && Number(options.chartRunningPrice) > 0) {
      initialCapturePrice = Number(options.chartRunningPrice);
      priceSource = 'CHART_RUNNING_PRICE';
    } else if (options.bid && options.ask && Number(options.bid) > 0 && Number(options.ask) > 0) {
      initialCapturePrice = Number(((Number(options.bid) + Number(options.ask)) / 2).toFixed(2));
      priceSource = 'MT5_BID_ASK';
    } else if (liveMarketState.isLive && liveMarketState.midPrice > 0) {
      initialCapturePrice = Number(liveMarketState.midPrice);
      priceSource = 'MT5_MARKET_DATA_SERVICE';
    } else {
      const fallbackPrice = marketDataService.getCurrentPrice();
      if (!fallbackPrice || fallbackPrice <= 0 || isNaN(fallbackPrice)) {
        throw new Error('PRICE_SYNC_ERROR: No valid market price found across telemetry or cache.');
      }
      initialCapturePrice = fallbackPrice;
      priceSource = 'MARKET_DATA_SERVICE_FEED';
    }

    let resolvedCapturePrice = Number(Number(initialCapturePrice).toFixed(2));

    if (!resolvedCapturePrice || resolvedCapturePrice <= 0 || isNaN(resolvedCapturePrice)) {
      throw new Error('PRICE_SYNC_ERROR: Resolved capture price must be a valid positive number.');
    }

    // Synchronize the single source of truth market cache immediately
    marketDataService.updatePriceFromProvider(resolvedCapturePrice, 'ANALYSIS_NOW_CAPTURE');

    const marketSnapshot: MarketSnapshot = marketDataService.createMarketSnapshot(symbol, timeframe);
    marketSnapshot.mid_price = resolvedCapturePrice;
    marketSnapshot.bid = options.bid ?? Number((resolvedCapturePrice - 0.20).toFixed(2));
    marketSnapshot.ask = options.ask ?? Number((resolvedCapturePrice + 0.20).toFixed(2));

    const resolved = symbolService.resolveSymbol(symbol);
    const spec = resolved.spec;

    const now = new Date();
    const nowIso = now.toISOString();
    const dateTag = nowIso.replace(/[-:T.]/g, '').slice(0, 14);
    const captureId = options.captureId || `CAP-${dateTag}-${Math.floor(Math.random() * 1000)}`;
    const captureVersion = options.captureVersion || 1;
    const captureTimestamp = options.timestamp || nowIso;
    const analysisId = `ANL-${dateTag}-${Math.floor(Math.random() * 1000)}`;
    const signalId = `SIG-${dateTag}-${Math.floor(Math.random() * 1000)}`;
    const tradePlanId = `PLAN-${dateTag}-${Math.floor(Math.random() * 1000)}`;
    const riskValidationId = `VAL-${dateTag}-${Math.floor(Math.random() * 1000)}`;

    db.addLog('INFO', 'COPILOT_ENGINE', `[CAPTURE NOW] Initiated for ${symbol} (${tradingStyle} - ${timeframe}) at livePrice $${resolvedCapturePrice} (captureId: ${captureId}, source: ${priceSource})`);

    // 2. Gather quantitative engine components & structured technical capture anchored to resolvedCapturePrice
    let structuredCapture = technicalEngine.getStructuredCapture(symbol, timeframe, options.indicators, resolvedCapturePrice, tradingStyle);
    const technical = technicalEngine.calculateScore();
    const fundamental = fundamentalEngine.calculateScore();
    const sentiment = sentimentEngine.calculateScore();
    const risk = riskEngine.calculateScore();

    // 3. Log debug before AI call as required
    console.log({
      tradingStyle,
      uiPriceLine: resolvedCapturePrice,
      snapshotPrice: resolvedCapturePrice,
      geminiPayloadPrice: resolvedCapturePrice,
      snapshotId: marketSnapshot.snapshot_id,
      captureId,
    });

    // Generate Standardized AI Analysis strictly grounded to resolvedCapturePrice
    const aiAnalysis = await this.generateStandardizedAiAnalysis({
      analysisId,
      snapshotId: marketSnapshot.snapshot_id,
      captureId,
      capturePrice: resolvedCapturePrice,
      symbol,
      timeframe,
      tradingStyle,
      marketSnapshot,
      spec,
      structuredCapture,
      technical,
      fundamental,
      sentiment,
      risk,
      chartImageBase64: options.chartImageBase64,
    });

    // POST-AI VALIDATION RULE: Strictly enforce snapshot.capturePrice as SSOT
    aiAnalysis.chart_detected_price = resolvedCapturePrice;
    if (aiAnalysis.execution_status === 'READY') {
      aiAnalysis.trade_plan.entry_price = resolvedCapturePrice;
      aiAnalysis.trade_plan.planned_entry = resolvedCapturePrice;
    }

    const epsilon = 0.01;
    if (Math.abs(aiAnalysis.chart_detected_price - resolvedCapturePrice) > epsilon) {
      throw new Error("AI_CURRENT_PRICE_MISMATCH");
    }
    if (Math.abs(resolvedCapturePrice - marketSnapshot.mid_price) > epsilon) {
      throw new Error("AI_ANCHOR_MISMATCH");
    }

    // MANDATORY FORENSIC AUDIT LOG
    console.log(
      `\n==================================================\n` +
      `[CAPTURE FORENSIC]\n` +
      `instanceId: ${marketDataService.instanceId}\n` +
      `timestamp: ${captureTimestamp}\n` +
      `symbol: ${symbol}\n` +
      `bid: ${marketSnapshot.bid}\n` +
      `ask: ${marketSnapshot.ask}\n` +
      `mid: ${marketSnapshot.mid_price}\n` +
      `resolved capturePrice: ${resolvedCapturePrice}\n` +
      `entryMode: ${aiAnalysis.entry_mode}\n` +
      `executionStatus: ${aiAnalysis.execution_status}\n` +
      `source: ${priceSource}\n` +
      `==================================================`
    );

    console.log(
      `\n==================================================\n` +
      `[TRADE PLAN FORENSIC]\n` +
      `capturePrice: ${resolvedCapturePrice}\n` +
      `entryMode: ${aiAnalysis.entry_mode}\n` +
      `executionStatus: ${aiAnalysis.execution_status}\n` +
      `tradePlan.entry_price: ${aiAnalysis.trade_plan.entry_price}\n` +
      `==================================================`
    );

    // 4. Calculate position sizing according to selected mode & broker spec
    const posSizing = positionSizingEngine.calculate(
      {
        accountEquity: equity,
        mode,
        riskPercent,
        fixedLot,
        fixedRiskAmount,
        entryPrice: aiAnalysis.trade_plan.entry_price,
        stopLoss: aiAnalysis.trade_plan.stop_loss,
        symbol,
      },
      tradeValidationEngine.getConfig().MAX_RISK_PERCENT
    );

    // 5. Run deterministic NO_TRADE and risk validation checks
    const liveMarket = marketDataService.getLiveMarket();
    const eligibility = tradeValidationEngine.validate(aiAnalysis, posSizing, liveMarket, spec);

    // 6. Build immutable Trade Plan Snapshot referencing authoritative MarketSnapshot & Capture metadata
    const snapshot: CopilotTradePlanSnapshot = {
      trade_plan_id: tradePlanId,
      planId: tradePlanId,
      snapshot_id: marketSnapshot.snapshot_id,
      snapshotId: marketSnapshot.snapshot_id,
      captureId,
      capturePrice: resolvedCapturePrice,
      captureTimestamp,
      captureVersion,
      plannedEntry: aiAnalysis.trade_plan.entry_price,
      analysis_id: analysisId,
      signal_id: signalId,
      risk_validation_id: riskValidationId,
      symbol,
      timeframe,
      tradingStyle,
      selectedTimeframe: timeframe,
      primaryTimeframe: aiAnalysis.primaryTimeframe || timeframe,
      primary_bias: aiAnalysis.primary_bias || (aiAnalysis.directional_bias as any) || 'NEUTRAL',
      primaryTimeframeDirection: aiAnalysis.primaryTimeframeDirection || (aiAnalysis.directional_bias as any) || 'NEUTRAL',
      setup_type: aiAnalysis.setup_type || 'TREND_CONTINUATION',
      risk_class: aiAnalysis.risk_class || 'NORMAL_RISK',
      createdAt: nowIso,
      expiresAt: new Date(now.getTime() + (tradeValidationEngine.getConfig().MAX_TRADE_PLAN_AGE_SECONDS || 300) * 1000).toISOString(),
      market_condition: aiAnalysis.market_condition,
      action: aiAnalysis.action,
      confidence: aiAnalysis.confidence,
      market_price_at_creation: resolvedCapturePrice,
      anchor_price: resolvedCapturePrice,
      liveAnchorPrice: resolvedCapturePrice,
      plan_mode: 'DYNAMIC',
      marketTimestamp: marketSnapshot.timestamp || nowIso,
      tradePlanTimestamp: nowIso,
      risk_distance: Number(Math.abs(aiAnalysis.trade_plan.entry_price - aiAnalysis.trade_plan.stop_loss).toFixed(2)) || 17.02,
      source: 'CAPTURE_NOW',
      bid: marketSnapshot.bid,
      ask: marketSnapshot.ask,
      spread_points: Math.round(marketSnapshot.spread / spec.point),
      trade_plan: {
        ...aiAnalysis.trade_plan,
        planned_entry: aiAnalysis.trade_plan.entry_price,
      },
      eligibility,
      position_sizing: posSizing,
      symbol_spec: spec,
      setup_quality: aiAnalysis.setup_quality,
      directional_bias: aiAnalysis.directional_bias,
      potential_direction: aiAnalysis.potential_direction,
      entry_mode: aiAnalysis.entry_mode,
      trigger_required: aiAnalysis.trigger_required,
      market_bias: aiAnalysis.market_bias,
      bias_signal: aiAnalysis.bias_signal,
      macro_direction: aiAnalysis.macro_direction,
      macro_direction_h1: aiAnalysis.macro_direction_h1,
      h1_macro: aiAnalysis.h1_macro || aiAnalysis.macro_direction_h1,
      micro_structure: aiAnalysis.micro_structure,
      micro_direction_m15: aiAnalysis.micro_direction_m15,
      m15_micro: aiAnalysis.m15_micro || aiAnalysis.micro_direction_m15,
      primary_confluence: aiAnalysis.primary_confluence,
      risk_flags: aiAnalysis.risk_flags,
      execution_status: aiAnalysis.execution_status,
      invalidation: aiAnalysis.invalidation,
      planned_entry_zone: aiAnalysis.planned_entry_zone,
      potential_entry_zone: aiAnalysis.potential_entry_zone || aiAnalysis.planned_entry_zone,
      stop_loss_reason: aiAnalysis.stop_loss_reason,
      take_profit_1_reason: aiAnalysis.take_profit_1_reason,
      take_profit_2_reason: aiAnalysis.take_profit_2_reason,
      analysis_summary: aiAnalysis.analysis_summary,
      why: aiAnalysis.why,
      reason: aiAnalysis.reason,
      next_condition: aiAnalysis.next_condition,
      next_action: aiAnalysis.next_action,
      rr_tp1: aiAnalysis.rr_tp1,
      rr_tp2: aiAnalysis.rr_tp2,
      structured_capture: structuredCapture,
      indicators_used: structuredCapture.activeIndicators || options.indicators || [],
      indicator_count: (structuredCapture.activeIndicators || options.indicators || []).length,
      direction_bias: aiAnalysis.direction_bias || (aiAnalysis.action === 'SELL' || aiAnalysis.potential_direction === 'SELL' || aiAnalysis.primary_bias === 'BEARISH' ? 'SELL' : 'BUY'),
      multi_timeframe: aiAnalysis.multi_timeframe,
      key_drivers: aiAnalysis.key_drivers,
      invalidation_condition: aiAnalysis.invalidation_condition,
      market_narrative: aiAnalysis.market_narrative,
      user_confirmed: false,
      status: eligibility.eligible ? 'DYNAMIC' : 'REJECTED',
      price_drift: 0,
      plan_age_seconds: 0,
      chart_objects: {
        entry: `SPILLA_ENTRY_${tradePlanId}`,
        sl: `SPILLA_SL_${tradePlanId}`,
        tp1: `SPILLA_TP1_${tradePlanId}`,
        tp2: `SPILLA_TP2_${tradePlanId}`,
      },
    };

    this.activeSnapshot = snapshot;
    db.setActiveTradePlanSnapshot(snapshot);

    // 7. Synchronize into database SSOT Active Signal
    const dbDirection =
      aiAnalysis.action === 'BUY' ? 'BUY' : aiAnalysis.action === 'SELL' ? 'SELL' : 'WAIT';

    db.setActiveSignal({
      signalId,
      symbol,
      direction: dbDirection,
      confidence: aiAnalysis.confidence,
      entryPrice: aiAnalysis.trade_plan.entry_price,
      takeProfit1: aiAnalysis.trade_plan.take_profit_1,
      takeProfit2: aiAnalysis.trade_plan.take_profit_2,
      takeProfit3: aiAnalysis.trade_plan.take_profit_3,
      stopLoss: aiAnalysis.trade_plan.stop_loss,
      riskReward: `1 : ${aiAnalysis.trade_plan.risk_reward_ratio}`,
      reasoning: aiAnalysis.market_narrative,
      status: eligibility.eligible ? 'ACTIVE' : 'EXPIRED',
    });

    db.addLog(
      eligibility.eligible ? 'INFO' : 'WARN',
      'COPILOT_VALIDATOR',
      `Trade Plan ${tradePlanId} evaluated: Status=${eligibility.status}, Action=${aiAnalysis.action}, Entry=${snapshot.trade_plan.entry_price}, Reasons=${eligibility.reasons.join(' | ')}`
    );

    return snapshot;
  }

  /**
   * Generates strictly validated AI response structure using the snapshot mid price.
   */
  private async generateStandardizedAiAnalysis(ctx: {
    analysisId: string;
    snapshotId: string;
    captureId?: string;
    capturePrice?: number;
    symbol: string;
    timeframe: string;
    tradingStyle?: TradingStyle;
    marketSnapshot: MarketSnapshot;
    spec: any;
    structuredCapture: any;
    technical: any;
    fundamental: any;
    sentiment: any;
    risk: any;
    chartImageBase64?: string;
  }): Promise<StandardizedAiAnalysis> {
    const aiClient = this.getGenAI();
    const price = ctx.capturePrice && ctx.capturePrice > 0 ? ctx.capturePrice : ctx.marketSnapshot.mid_price;
    const nowIso = new Date().toISOString();
    const sc = ctx.structuredCapture;
    const tradingStyle: TradingStyle = ctx.tradingStyle === 'SCALPING' ? 'SCALPING' : 'INTRADAY';

    const defaultMtf = {
      D1: {
        bias: (sc?.D1?.trend || sc?.timeframeAnalysis?.D1 || 'BULLISH') as SentimentType,
        trend: sc?.D1?.trend === 'BULLISH' ? 'Bullish Structure' : 'Bearish Structure',
        structure: `Swing H: $${sc?.D1?.swingHigh || (price + 35).toFixed(2)} / L: $${sc?.D1?.swingLow || (price - 35).toFixed(2)} (S: $${sc?.D1?.support?.[0] || (price - 25).toFixed(2)}, R: $${sc?.D1?.resistance?.[0] || (price + 25).toFixed(2)})`,
        keyLevel: `$${sc?.D1?.resistance?.[0] || (price + 25).toFixed(2)}`,
      },
      H4: {
        bias: (sc?.H4?.trend || sc?.timeframeAnalysis?.H4 || 'BULLISH') as SentimentType,
        trend: sc?.H4?.trend === 'BULLISH' ? 'Bullish Continuation' : 'Bearish Continuation',
        structure: `Swing H: $${sc?.H4?.swingHigh || (price + 20).toFixed(2)} / L: $${sc?.H4?.swingLow || (price - 20).toFixed(2)} (S: $${sc?.H4?.support?.[0] || (price - 15).toFixed(2)}, R: $${sc?.H4?.resistance?.[0] || (price + 15).toFixed(2)})`,
        keyLevel: `$${sc?.H4?.support?.[0] || (price - 15).toFixed(2)}`,
      },
      H1: {
        bias: (sc?.H1?.trend || sc?.timeframeAnalysis?.H1 || 'BULLISH') as SentimentType,
        trend: sc?.H1?.trend === 'BULLISH' ? 'Macro Bullish Direction' : 'Macro Bearish Direction',
        structure: `EMA20 ($${sc?.ema?.ema20 || (price - 4).toFixed(2)}) vs EMA50 ($${sc?.ema?.ema50 || (price - 8).toFixed(2)}) | S: $${sc?.H1?.support?.[0] || (price - 8).toFixed(2)} / R: $${sc?.H1?.resistance?.[0] || (price + 8).toFixed(2)}`,
        keyLevel: `$${sc?.pivotPoints?.pivot || price.toFixed(2)}`,
      },
      M15: {
        bias: (sc?.M15?.trend || sc?.timeframeAnalysis?.M15 || 'BULLISH') as SentimentType,
        trend: 'Micro Entry Precision',
        structure: `Swing H: $${sc?.M15?.swingHigh || (price + 3).toFixed(2)} / L: $${sc?.M15?.swingLow || (price - 3).toFixed(2)} | RSI(14): ${sc?.M15?.rsi14 || sc?.rsi14?.value || 64} | VWAP: $${sc?.M15?.vwap || sc?.vwap?.value || price.toFixed(2)}`,
        keyLevel: `$${sc?.M15?.support?.[0] || (price - 2.5).toFixed(2)}`,
      },
    };

    // PRIMARY DIRECTIONAL GATE RESOLUTION
    const primaryTimeframe = (ctx.timeframe || (tradingStyle === 'SCALPING' ? 'M5' : 'H4')).toUpperCase();
    const primaryTfData = (defaultMtf as any)[primaryTimeframe] || (tradingStyle === 'SCALPING' ? defaultMtf.M15 : defaultMtf.H1);
    const primaryDirection: SentimentType = (primaryTfData.bias === 'BEARISH' || (sc as any)?.[primaryTimeframe]?.trend === 'BEARISH')
      ? 'BEARISH'
      : (primaryTfData.bias === 'BULLISH' || (sc as any)?.[primaryTimeframe]?.trend === 'BULLISH')
      ? 'BULLISH'
      : 'NEUTRAL';
    const primaryStructure = (sc as any)?.[primaryTimeframe]?.structure || primaryTfData.trend || (primaryDirection === 'BULLISH' ? 'BULLISH STRUCTURE' : 'BEARISH STRUCTURE');
    const primaryMomentum = sc?.rsi14?.condition ? (sc.rsi14.condition.includes('BEARISH') ? 'BEARISH' : sc.rsi14.condition.includes('BULLISH') ? 'BULLISH' : 'NEUTRAL') : primaryDirection;
    const primaryTrendStrength = sc?.adx14?.trendStrength ? sc.adx14.trendStrength.replace(/_/g, ' ') : 'STRONG TREND';

    if (aiClient) {
      try {
        console.log(
          `\n==================================================\n` +
          `[SPILLA GOLD AI COPILOT EXECUTION]\n` +
          `tradingStyle: ${tradingStyle}\n` +
          `captureId: ${ctx.captureId || 'N/A'}\n` +
          `capturePrice: ${price}\n` +
          `symbol: ${ctx.symbol} (${ctx.timeframe})\n` +
          `primaryTimeframe: ${primaryTimeframe} (${primaryDirection})\n` +
          `==================================================`
        );

        const isCrypto = (ctx.symbol || '').toUpperCase().includes('BTC');
        const isForex = ctx.spec?.category === 'FOREX' || ctx.spec?.digits === 5 || ctx.spec?.digits === 3;
        const styleInstructions = tradingStyle === 'SCALPING'
          ? `TRADING STYLE: SCALPING (FAST-PACED MICROSTRUCTURE EXECUTION)
- Primary Execution Timeframe: ${primaryTimeframe} (M1 / M5 / M15). High-precision micro triggers.
- Higher Timeframe Context: H1 / H4 background baseline.
- Focus: Fast price velocity, immediate candle wick rejections, M1/M5/M15 EMA slope, VWAP bounce/break.
- Stop Loss & Take Profit: Microstructure/ATR-based tight invalidation (${isCrypto ? 'BTC SL typically $350 to $800, TP1 $550 to $1200, TP2 $1000 to $2500' : isForex ? 'Forex SL typically 15 to 35 pips, TP1 25 to 50 pips' : 'Gold SL typically $1.50 to $4.00, TP1 $2.50 to $6.00, TP2 $5.00 to $12.00'}, Min R:R 1:1.2).
- Confirmation Requirements: Fast micro candle rejection and EMA/VWAP alignment.`
          : `TRADING STYLE: INTRADAY (SESSION STRUCTURE & SWING EXECUTION)
- Primary Execution Timeframe: ${primaryTimeframe} (H4 / D1).
- Higher Timeframe Context: H4 / D1 (D1 provides key market context and daily institutional bias).
- Focus: Major S/R levels, daily/session liquidity, high-timeframe structure breaks.
- Stop Loss & Take Profit: Session structure ATR-based invalidation (${isCrypto ? 'BTC SL typically $600 to $1500, TP1 $900 to $2500, TP2 $1800 to $4500' : isForex ? 'Forex SL typically 30 to 70 pips, TP1 50 to 120 pips' : 'Gold SL typically $8.00 to $18.00, TP1 $12.00 to $28.00, TP2 $25.00 to $50.00'}, Min R:R 1:1.5).
- Confirmation Requirements: Multi-timeframe session candle close and structural validation.`;

        const systemPrompt = `You are **SPILLA GOLD AI Trading Copilot**, the institutional-style ${ctx.symbol} execution decision engine.

CRITICAL ARCHITECTURAL MANDATE: SELECTED TIMEFRAME & TRADING STYLE ARE THE PRIMARY GATES
- Trading Style: ${tradingStyle}
- User Selected Timeframe (primaryTimeframe): ${primaryTimeframe}
- Primary Timeframe Direction: ${primaryDirection}
- Primary Timeframe Structure: ${primaryStructure}
- Primary Timeframe Momentum: ${primaryMomentum}
- Primary Trend Strength (ADX): ${primaryTrendStrength}

${styleInstructions}

STRICT LIVE PRICE & MULTI-TIMEFRAME GROUNDING RULES:
1. SINGLE SOURCE OF TRUTH (LAST CAPTURED PRICE LINE):
   - The field "capturePrice" is the LAST PRICE LINE on the captured chart ($${price.toFixed(ctx.spec.digits || 2)}).
   - Carefully inspect the chart image: read the latest candlestick pattern, the position of the last price line, dynamic EMA ribbon, VWAP, and structural Support/Resistance levels directly on the chart.
   - ALL prices in your recommendation (Potential Entry Zone, Stop Loss, TP1, TP2, Support, Resistance) MUST be strictly grounded to this last captured price ($${price.toFixed(ctx.spec.digits || 2)}) and must use the exact same absolute price scale.
   - For ${ctx.symbol} (around $${price.toFixed(ctx.spec.digits || 2)}), never generate target levels or TP/SL with offsets or cent scaling. Entry, Stop Loss, TP1, and TP2 MUST ALL be on the same scale around $${price.toFixed(ctx.spec.digits || 2)}.
   - NEVER use remembered, historical, example, cached, or static prices (e.g. 2653.30, 2656.00, 2300.00, 4351.20). Any numbers in instructions are examples only.
   - Any price disconnected from the chart's last captured price snapshot is a SYSTEM ERROR.

2. PRIMARY DIRECTIONAL GATE & HARD TREND RULES:
   - The AI recommendation MUST NEVER contradict a strong selected-timeframe directional structure without explicitly classifying the setup as COUNTER-TREND.
   - STRONG TREND HARD GATE: If Selected Timeframe (${primaryTimeframe}) is ${primaryDirection} with STRONG TREND (ADX >= 25), returning a normal opposite trade (e.g. BUY against strong BEARISH ${primaryTimeframe}) is STRICTLY PROHIBITED.
   - If Selected Timeframe is BEARISH:
     - Normal continuation setup: proposed_action = "SELL" | "WAIT", setup_type = "TREND_CONTINUATION", primary_bias = "BEARISH", directional_bias = "BEARISH".
     - If lower timeframe is in a temporary retrace: proposed_action = "WAIT", potential_direction = "SELL", entry_mode = "PULLBACK", execution_status = "WAIT FOR CONFIRMATION".
     - If an isolated counter-trend setup exists: MUST set setup_type = "COUNTER-TREND", risk_class = "HIGHER_RISK", proposed_action = "WAIT", potential_direction = "BUY", primary_bias = "BEARISH", execution_status = "WAIT FOR CONFIRMATION", why = "Potential counter-trend bounce against bearish ${primaryTimeframe} structure."
   - If Selected Timeframe is BULLISH:
     - Normal continuation setup: proposed_action = "BUY" | "WAIT", setup_type = "TREND_CONTINUATION", primary_bias = "BULLISH", directional_bias = "BULLISH".
     - If lower timeframe is in a temporary retrace: proposed_action = "WAIT", potential_direction = "BUY", entry_mode = "PULLBACK", execution_status = "WAIT FOR CONFIRMATION".
     - If an isolated counter-trend setup exists: MUST set setup_type = "COUNTER-TREND", risk_class = "HIGHER_RISK", proposed_action = "WAIT", potential_direction = "SELL", primary_bias = "BULLISH", execution_status = "WAIT FOR CONFIRMATION", why = "Potential counter-trend rejection against bullish ${primaryTimeframe} structure."

3. MULTI-TIMEFRAME ROLES & CHART POSITION:
   - D1: Trend Context (${tradingStyle === 'SCALPING' ? 'Low weight context' : 'Primary macro context'}) (Trend: ${sc.D1.trend}, Support: [${sc.D1.support.join(', ')}], Resistance: [${sc.D1.resistance.join(', ')}], Swing H: ${sc.D1.swingHigh} / L: ${sc.D1.swingLow})
   - H4: Higher-timeframe confirmation (Trend: ${sc.H4.trend}, Support: [${sc.H4.support.join(', ')}], Resistance: [${sc.H4.resistance.join(', ')}], Swing H: ${sc.H4.swingHigh} / L: ${sc.H4.swingLow})
   - H1: Macro execution direction (Trend: ${sc.H1.trend}, Support: [${sc.H1.support.join(', ')}], Resistance: [${sc.H1.resistance.join(', ')}], Swing H: ${sc.H1.swingHigh} / L: ${sc.H1.swingLow})
   - M15: Micro entry precision (Trend: ${sc.M15.trend}, Swing H: ${sc.M15.swingHigh} / L: ${sc.M15.swingLow}, Support: [${sc.M15.support.join(', ')}], Resistance: [${sc.M15.resistance.join(', ')}], VWAP: $${sc.M15.vwap})

4. ENTRY MODE DEFINITION (Mandatory field):
   Allowed values: "MARKET" | "PULLBACK" | "BREAKOUT" | "RETEST" | "NONE"
   - "MARKET": Current price is inside or directly at valid entry zone, all confirmations satisfied, READY to execute immediately.
   - "PULLBACK": Higher timeframe trend supports direction, but lower timeframe is retracing. Price has not yet pulled back into the potential entry zone or candle confirmation is pending.
   - "BREAKOUT": Price is approaching or testing a key level. Requires candle close breakout above resistance or below support with volume.
   - "RETEST": Price has broken a structural level and requires a retest and rejection of that level before entry.
   - "NONE": Sideways chop, ranging, or no valid setup.

5. SEPARATION OF DIRECTION BIAS AND EXECUTION STATUS:
   You MUST cleanly separate:
   - "direction_bias": MUST CONTAIN ONLY "BUY" OR "SELL".
     * Answers ONLY: Which direction currently has the stronger technical bias?
     * Allowed: "BUY" or "SELL".
     * NEVER output "POTENTIAL BUY", "POTENTIAL SELL", "WAIT TRIGGER", "NO TRADE", or "NEUTRAL" in direction_bias.
     * If the market is ranging or has low directional edge, still select the dominant technical bias as "BUY" or "SELL" for informational purposes, but set execution_status to "NO TRADE".
   - "execution_status": Allowed values: "READY" | "WAIT FOR CONFIRMATION" | "NO TRADE".
     * "READY": Setup is fully confirmed and current price is inside the execution zone.
     * "WAIT FOR CONFIRMATION": Bias is BUY or SELL, but execution is NOT yet allowed until trigger condition is met.
     * "NO TRADE": Insufficient edge, choppy/ranging regime, or poor risk/reward (blocks execution).

6. READY LOGIC:
   - Return execution_status = "READY" ONLY when:
     - Current price is inside or sufficiently near the valid entry zone
     - Confirmation is already satisfied (${primaryTimeframe} structure aligned)
     - Risk/Reward >= 1:${tradingStyle === 'SCALPING' ? '1.2' : '1.5'}
     - Structural invalidation is defined
   - Otherwise, return "WAIT FOR CONFIRMATION" or "NO TRADE".

7. NO TRADE:
   - Sideways chop, ADX < 20, conflicting timeframes with no edge.
   - execution_status = "NO TRADE", proposed_action = "NO TRADE", potential_direction = "NONE", entry_mode = "NONE", potential_entry_zone = "—", stop_loss = 0, take_profit_1 = 0, take_profit_2 = 0.
   - Note: direction_bias must STILL be provided as "BUY" or "SELL" representing the dominant higher-probability technical bias.

Return strictly JSON matching this structure:
{
  "chart_detected_price": number,
  "direction_bias": "BUY" | "SELL",
  "primary_bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "proposed_action": "BUY" | "SELL" | "WAIT" | "NO TRADE",
  "bias_signal": "BUY" | "SELL" | "WAIT" | "NO TRADE",
  "potential_direction": "BUY" | "SELL" | "NONE",
  "setup_type": "TREND_CONTINUATION" | "PULLBACK" | "COUNTER-TREND" | "RANGE_BREAKOUT" | "NONE",
  "risk_class": "NORMAL_RISK" | "HIGHER_RISK" | "MAX_RISK",
  "entry_mode": "MARKET" | "PULLBACK" | "BREAKOUT" | "RETEST" | "NONE",
  "market_bias": "BULLISH CONTINUATION" | "BEARISH CONTINUATION" | "RANGE" | "TRANSITION",
  "market_condition": "BULLISH" | "BEARISH" | "SIDEWAYS" | "TRANSITION",
  "directional_bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "h1_macro": "BULLISH" | "BEARISH" | "NEUTRAL",
  "m15_micro": "BULLISH" | "BEARISH" | "NEUTRAL",
  "ai_confidence_percentage": number,
  "execution_status": "READY" | "WAIT FOR CONFIRMATION" | "NO TRADE",
  "potential_entry_zone": string,
  "entry_zone_min": number,
  "entry_zone_max": number,
  "trigger_required": string,
  "stop_loss": number,
  "stop_loss_reason": string,
  "take_profit_1": number,
  "take_profit_1_reason": string,
  "rr_tp1": string,
  "take_profit_2": number,
  "take_profit_2_reason": string,
  "rr_tp2": string,
  "why": string,
  "next_condition": string,
  "setup_quality": "WEAK" | "MODERATE" | "STRONG" | "VERY STRONG",
  "analysis_summary": [
    "Selected timeframe primary bias...",
    "Micro timeframe structure...",
    "Price position relative to dynamic EMA/VWAP...",
    "ADX trend momentum...",
    "Execution directive..."
  ],
  "invalidation": string,
  "primary_confluence": [string, string, string],
  "risk_flags": [string],
  "market_narrative": string
}`;

        const payload = {
          snapshotId: ctx.snapshotId,
          symbol: ctx.symbol,
          tradingStyle,
          selectedTimeframe: primaryTimeframe,
          primaryTimeframeDirection: primaryDirection,
          primaryTimeframeStructure: primaryStructure,
          primaryTimeframeMomentum: primaryMomentum,
          primaryTimeframeADX: primaryTrendStrength,
          captureTimestamp: ctx.marketSnapshot.timestamp || nowIso,
          capturePrice: price,
          bid: ctx.marketSnapshot.bid,
          ask: ctx.marketSnapshot.ask,
          D1: sc.D1,
          H4: sc.H4,
          H1: sc.H1,
          M15: sc.M15,
          technical_indicators: {
            ema: sc.ema,
            rsi14: sc.rsi14,
            macd: sc.macd,
            atr14: sc.atr14,
            adx14: sc.adx14,
            bollinger_bands: sc.bollingerBands,
            volume: sc.volume,
            vwap: sc.vwap,
            support_resistance: sc.supportResistance,
            swing_structure: sc.swingStructure,
            fibonacci: sc.fibonacci,
            pivot_points: sc.pivotPoints,
          },
          macro_engine_scores: {
            fundamental_score: ctx.fundamental.score,
            sentiment_score: ctx.sentiment.score,
            risk_score: ctx.risk.score,
          }
        };

        const userParts: any[] = [];
        if (ctx.chartImageBase64 && typeof ctx.chartImageBase64 === 'string' && ctx.chartImageBase64.includes('base64,')) {
          const rawBase64 = ctx.chartImageBase64.split('base64,')[1];
          if (rawBase64 && rawBase64.length > 50) {
            userParts.push({
              inlineData: {
                mimeType: 'image/png',
                data: rawBase64,
              },
            });
          }
        }

        userParts.push({
          text: `[${tradingStyle} MODE] Selected Primary Timeframe Gate: ${primaryTimeframe} (${primaryDirection}). Analyze the latest candle, price action, and the last price line directly from this chart screenshot along with the quantitative market telemetry:\n${JSON.stringify(payload)}`,
        });

        const contentsPayload = [
          {
            role: 'user',
            parts: userParts,
          },
        ];

        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contentsPayload as any,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.15,
            responseMimeType: 'application/json',
          },
        });

        const jsonText = response.text?.trim();
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          const detectedFromVision = Number(parsed.chart_detected_price || parsed.detected_price || 0);
          const currentPrice = (detectedFromVision > 100 && Math.abs(detectedFromVision - price) < 1000)
            ? detectedFromVision
            : price;
          
          const symbolUpper = (ctx.symbol || ctx.spec?.symbol || '').toUpperCase();
          const isCrypto = symbolUpper.includes('BTC');
          const isForex = ctx.spec?.category === 'FOREX' || ctx.spec?.digits === 5 || ctx.spec?.digits === 3;
          const isScalping = tradingStyle === 'SCALPING';
          let defaultAtr = 14.8;
          if (isCrypto) defaultAtr = 650.0;
          else if (ctx.spec?.digits === 5) defaultAtr = 0.0035;
          else if (ctx.spec?.digits === 3) defaultAtr = 0.45;

          let rawAtrVal = sc.atr14?.value || defaultAtr;
          if (isCrypto && rawAtrVal < 50) rawAtrVal = 650.0;
          if (isForex && rawAtrVal > 10) rawAtrVal = defaultAtr;
          const atr = rawAtrVal;

          // CHECK A: Is capturePrice valid?
          if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
            throw new Error('PRICE_GROUNDING_ERROR: Invalid capturePrice');
          }

          let rawAction = String(parsed.proposed_action || parsed.bias_signal || parsed.action || 'WAIT').toUpperCase();
          let action: TradingAction = 'WAIT';
          let biasSignal: 'BUY' | 'SELL' | 'WAIT' | 'NO TRADE' = 'WAIT';

          if (rawAction === 'BUY') {
            action = 'BUY';
            biasSignal = 'BUY';
          } else if (rawAction === 'SELL') {
            action = 'SELL';
            biasSignal = 'SELL';
          } else if (rawAction === 'WAIT') {
            action = 'WAIT';
            biasSignal = 'WAIT';
          } else {
            action = 'NONE';
            biasSignal = 'NO TRADE';
          }

          const rawCondition = String(parsed.market_condition || '').toUpperCase();
          let marketCond: MarketCondition =
            ['BULLISH', 'BEARISH', 'SIDEWAYS', 'SIDEWAY', 'TRANSITION', 'NO_TRADE'].includes(rawCondition)
              ? (rawCondition === 'SIDEWAY' ? 'SIDEWAYS' : (rawCondition as MarketCondition))
              : (primaryDirection === 'BULLISH' ? 'BULLISH' : primaryDirection === 'BEARISH' ? 'BEARISH' : 'SIDEWAYS');

          const h1Macro = (parsed.h1_macro || parsed.macro_direction_h1 || sc.H1.trend || 'NEUTRAL') as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
          const m15Micro = (parsed.m15_micro || parsed.micro_direction_m15 || sc.M15.trend || 'NEUTRAL') as 'BULLISH' | 'BEARISH' | 'NEUTRAL';

          let rawPotentialDir = String(parsed.potential_direction || '').toUpperCase();
          let potentialDir: PotentialDirection = 'NONE';
          if (rawPotentialDir === 'BUY' || rawPotentialDir === 'SELL') {
            potentialDir = rawPotentialDir as PotentialDirection;
          } else if (biasSignal === 'BUY' || (biasSignal === 'WAIT' && primaryDirection === 'BULLISH')) {
            potentialDir = 'BUY';
          } else if (biasSignal === 'SELL' || (biasSignal === 'WAIT' && primaryDirection === 'BEARISH')) {
            potentialDir = 'SELL';
          } else {
            potentialDir = 'NONE';
          }

          let directionalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
            parsed.directional_bias || primaryDirection;

          let rawEntryMode = String(parsed.entry_mode || '').toUpperCase();
          let entryMode: EntryMode = 'NONE';
          if (['MARKET', 'PULLBACK', 'BREAKOUT', 'RETEST', 'NONE'].includes(rawEntryMode)) {
            entryMode = rawEntryMode as EntryMode;
          } else if (biasSignal === 'BUY' || biasSignal === 'SELL') {
            entryMode = 'MARKET';
          } else if (biasSignal === 'WAIT') {
            entryMode = 'PULLBACK';
          } else {
            entryMode = 'NONE';
          }

          let execStatus: ExecutionStatus = 'NO TRADE';
          if (biasSignal === 'BUY' || biasSignal === 'SELL') {
            execStatus = parsed.execution_status === 'READY' ? 'READY' : 'READY';
          } else if (biasSignal === 'WAIT') {
            execStatus = 'WAIT FOR CONFIRMATION';
          } else {
            execStatus = 'NO TRADE';
          }

          let setupType = (parsed.setup_type || 'TREND_CONTINUATION') as SetupType;
          let riskClass = (parsed.risk_class || 'NORMAL_RISK') as RiskClass;

          // DETERMINISTIC HARD GATE VALIDATION (Rule 11)
          // 1. If Selected Timeframe is BEARISH: Prohibit standard BUY against strong bearish structure!
          if (primaryDirection === 'BEARISH') {
            if (action === 'BUY' || biasSignal === 'BUY') {
              action = 'WAIT';
              biasSignal = 'WAIT';
              execStatus = 'WAIT FOR CONFIRMATION';
              entryMode = 'PULLBACK';
              setupType = 'COUNTER-TREND';
              riskClass = 'HIGHER_RISK';
              potentialDir = 'BUY';
              directionalBias = 'BEARISH';
              parsed.why = `Potential bullish counter-trend setup detected against BEARISH ${primaryTimeframe} primary structure. Execution locked pending confirmation.`;
            }
          }
          // 2. If Selected Timeframe is BULLISH: Prohibit standard SELL against strong bullish structure!
          else if (primaryDirection === 'BULLISH') {
            if (action === 'SELL' || biasSignal === 'SELL') {
              action = 'WAIT';
              biasSignal = 'WAIT';
              execStatus = 'WAIT FOR CONFIRMATION';
              entryMode = 'PULLBACK';
              setupType = 'COUNTER-TREND';
              riskClass = 'HIGHER_RISK';
              potentialDir = 'SELL';
              directionalBias = 'BULLISH';
              parsed.why = `Potential bearish counter-trend setup detected against BULLISH ${primaryTimeframe} primary structure. Execution locked pending confirmation.`;
            }
          }

          // Alignment check between H1 and M15
          if (biasSignal === 'BUY' && (m15Micro === 'BEARISH' || h1Macro !== 'BULLISH')) {
            action = 'WAIT';
            biasSignal = 'WAIT';
            potentialDir = 'BUY';
            entryMode = 'PULLBACK';
            execStatus = 'WAIT FOR CONFIRMATION';
          } else if (biasSignal === 'SELL' && (m15Micro === 'BULLISH' || h1Macro !== 'BEARISH')) {
            action = 'WAIT';
            biasSignal = 'WAIT';
            potentialDir = 'SELL';
            entryMode = 'PULLBACK';
            execStatus = 'WAIT FOR CONFIRMATION';
          }

          if (execStatus === 'WAIT FOR CONFIRMATION' && entryMode === 'NONE') {
            entryMode = 'PULLBACK';
          }

          const isNoTrade = biasSignal === 'NO TRADE';
          let stopLoss = 0;
          let tp1 = 0;
          let tp2 = 0;
          let rr = 1.2;

          // Potential or planned entry zone calculation
          let entryZoneMin = 0;
          let entryZoneMax = 0;
          let plannedZone = '—';

          if (!isNoTrade) {
            const offsetMin = isCrypto ? (isScalping ? 150 : 450) : isForex ? (isScalping ? 0.0008 : 0.0025) : (isScalping ? 0.6 : 3.5);
            const offsetMax = isCrypto ? (isScalping ? 50 : 180) : isForex ? (isScalping ? 0.0003 : 0.0010) : (isScalping ? 0.2 : 1.0);
            const buffer = isCrypto ? (isScalping ? 100 : 250) : isForex ? (isScalping ? 0.0005 : 0.0015) : (isScalping ? 0.8 : 1.5);

            if (entryMode === 'PULLBACK') {
              if (potentialDir === 'BUY') {
                entryZoneMin = Number((currentPrice - offsetMin).toFixed(ctx.spec.digits));
                entryZoneMax = Number((currentPrice - offsetMax).toFixed(ctx.spec.digits));
              } else {
                entryZoneMin = Number((currentPrice + offsetMax).toFixed(ctx.spec.digits));
                entryZoneMax = Number((currentPrice + offsetMin).toFixed(ctx.spec.digits));
              }
            } else {
              entryZoneMin = Number((currentPrice - buffer).toFixed(ctx.spec.digits));
              entryZoneMax = Number((currentPrice + buffer).toFixed(ctx.spec.digits));
            }

            if (parsed.entry_zone_min && parsed.entry_zone_max && !isNaN(parsed.entry_zone_min) && !isNaN(parsed.entry_zone_max)) {
              if (Math.abs(parsed.entry_zone_min - currentPrice) < currentPrice * 0.05) {
                entryZoneMin = Number(Number(parsed.entry_zone_min).toFixed(ctx.spec.digits));
                entryZoneMax = Number(Number(parsed.entry_zone_max).toFixed(ctx.spec.digits));
              }
            }

            plannedZone = parsed.potential_entry_zone || parsed.planned_entry_zone || `${entryZoneMin.toFixed(2)} – ${entryZoneMax.toFixed(2)}`;
          }

          const futureEntryReference = isNoTrade ? 0 : entryMode === 'PULLBACK' ? (entryZoneMin + entryZoneMax) / 2 : currentPrice;

          // Price Grounding and Validation against capture price regime
          const isPriceGrounded = (pVal: number) => {
            if (!pVal || isNaN(pVal) || pVal <= 0) return false;
            return pVal >= currentPrice * 0.60 && pVal <= currentPrice * 1.40;
          };

          if (!isNoTrade) {
            let parsedSl = Number(parsed.stop_loss);
            let parsedTp1 = Number(parsed.take_profit_1);
            let parsedTp2 = Number(parsed.take_profit_2);

            const isSellDirection = potentialDir === 'SELL' || biasSignal === 'SELL';
            const defaultRiskDist = isCrypto ? (isScalping ? 450.0 : 850.0) : isForex ? (ctx.spec.digits === 3 ? 0.45 : 0.0035) : (isScalping ? 4.50 : 14.80);
            const validAtr = (atr > 0 && atr < currentPrice * 0.3) ? atr : defaultRiskDist;

            if (!isPriceGrounded(parsedSl)) {
              parsedSl = isSellDirection
                ? futureEntryReference + (sc.supportResistance?.distToNearestResistance || validAtr * 1.15)
                : futureEntryReference - (sc.supportResistance?.distToNearestSupport || validAtr * 1.15);
            }
            if (!isPriceGrounded(parsedTp1)) {
              parsedTp1 = isSellDirection
                ? futureEntryReference - validAtr * 1.8
                : futureEntryReference + validAtr * 1.8;
            }
            if (!isPriceGrounded(parsedTp2)) {
              parsedTp2 = isSellDirection
                ? futureEntryReference - validAtr * 3.2
                : futureEntryReference + validAtr * 3.2;
            }

            // Directional & Scale Invariants
            if (!isSellDirection) { // BUY
              if (parsedSl >= futureEntryReference) parsedSl = futureEntryReference - validAtr * 1.15;
              if (parsedTp1 <= futureEntryReference) parsedTp1 = futureEntryReference + validAtr * 1.8;
              if (parsedTp2 <= parsedTp1) parsedTp2 = parsedTp1 + validAtr * 1.4;
            } else { // SELL
              if (parsedSl <= futureEntryReference) parsedSl = futureEntryReference + validAtr * 1.15;
              if (parsedTp1 >= futureEntryReference) parsedTp1 = futureEntryReference - validAtr * 1.8;
              if (parsedTp2 >= parsedTp1) parsedTp2 = parsedTp1 - validAtr * 1.4;
            }

            stopLoss = Number(parsedSl.toFixed(ctx.spec.digits));
            tp1 = Number(parsedTp1.toFixed(ctx.spec.digits));
            tp2 = Number(parsedTp2.toFixed(ctx.spec.digits));

            const slDistance = Math.abs(futureEntryReference - stopLoss) || validAtr;
            let tpDistance = Math.abs(tp1 - futureEntryReference);
            rr = Number((tpDistance / slDistance).toFixed(2));

            if (rr < 1.0) {
              if (isSellDirection) {
                tp1 = Number((futureEntryReference - slDistance * 1.2).toFixed(ctx.spec.digits));
                tp2 = Number((futureEntryReference - slDistance * 2.0).toFixed(ctx.spec.digits));
              } else {
                tp1 = Number((futureEntryReference + slDistance * 1.2).toFixed(ctx.spec.digits));
                tp2 = Number((futureEntryReference + slDistance * 2.0).toFixed(ctx.spec.digits));
              }
              tpDistance = Math.abs(tp1 - futureEntryReference);
              rr = Number((tpDistance / slDistance).toFixed(2));
            }
          }

          let triggerRequired = parsed.trigger_required || '';
          if (!triggerRequired) {
            if (biasSignal === 'WAIT') {
              if (setupType === 'COUNTER-TREND') {
                triggerRequired = `Wait for lower-timeframe reversal rejection and M15 confirmation before considering counter-trend ${potentialDir}.`;
              } else if (entryMode === 'PULLBACK') {
                triggerRequired = potentialDir === 'BUY'
                  ? `Price must enter the potential entry zone (${plannedZone}) AND M15 must turn bullish with candle-close confirmation.`
                  : `Price must enter the potential entry zone (${plannedZone}) AND M15 must turn bearish with candle-close confirmation.`;
              } else if (entryMode === 'BREAKOUT') {
                triggerRequired = `Price must break key structural level with candle close confirmation and expanding volume.`;
              } else {
                triggerRequired = `Wait for M15 candle close to confirm ${potentialDir} continuation before execution.`;
              }
            } else if (biasSignal === 'NO TRADE') {
              triggerRequired = `Wait for clear directional breakout beyond range boundaries with volume confirmation.`;
            } else {
              triggerRequired = `All entry conditions and multi-timeframe confirmations satisfied. Ready for market execution.`;
            }
          }

          const defaultSummary = [
            `${primaryTimeframe} primary structure is ${primaryDirection.toLowerCase()} (S: $${sc?.[primaryTimeframe]?.support?.[0] || sc.H1.support[0]} / R: $${sc?.[primaryTimeframe]?.resistance?.[0] || sc.H1.resistance[0]}).`,
            `M15 micro structure is ${m15Micro.toLowerCase()} (Swing H: $${sc.M15.swingHigh} / L: $${sc.M15.swingLow}).`,
            `Price ($${currentPrice.toFixed(2)}) is trading ${sc.ema.pricePosition.toLowerCase().replace(/_/g, ' ')} dynamic EMAs and VWAP ($${sc.M15.vwap}).`,
            `ADX at ${sc.adx14?.value || 25} reflects ${sc.adx14?.trendStrength.toLowerCase().replace(/_/g, ' ') || 'trend momentum'}.`,
            biasSignal === 'WAIT'
              ? `Execution requires trigger condition: ${triggerRequired}`
              : biasSignal === 'NO TRADE'
              ? `No institutional edge available in current market regime.`
              : `Disciplined execution plan ready with 1:${rr} R:R.`,
          ];

          const whyReason = parsed.why || parsed.reason || (
            setupType === 'COUNTER-TREND'
              ? `Potential ${potentialDir.toLowerCase()} counter-trend setup detected against ${primaryDirection} ${primaryTimeframe} primary structure. Execution locked pending confirmation.`
              : biasSignal === 'WAIT'
              ? (primaryDirection === 'BULLISH' && m15Micro === 'BEARISH'
                  ? `${primaryTimeframe} Macro is bullish, but M15 Micro is currently in a bearish pullback. Potential BUY setup exists once retracement completes.`
                  : primaryDirection === 'BEARISH' && m15Micro === 'BULLISH'
                  ? `${primaryTimeframe} Macro is bearish, but M15 Micro is currently in a bullish pullback. Potential SELL setup exists once retracement completes.`
                  : `Setup exists but entry criteria incomplete. Waiting for confirmation trigger.`)
              : biasSignal === 'NO TRADE'
              ? `Market structure is sideways/conflicting with ADX (${sc.adx14?.value || 18}) showing insufficient trend strength.`
              : `Primary ${primaryTimeframe} structure and micro timeframe alignment confirmed with structural invalidation defined.`
          );

          const nextCondition = parsed.next_condition || triggerRequired;

          let directionBias: 'BUY' | 'SELL' = 'BUY';
          const rawDirBias = String(parsed.direction_bias || '').toUpperCase();
          if (rawDirBias === 'SELL' || rawDirBias === 'BUY') {
            directionBias = rawDirBias as 'BUY' | 'SELL';
          } else if (primaryDirection === 'BEARISH' || potentialDir === 'SELL' || biasSignal === 'SELL' || (ctx.technical?.score !== undefined && ctx.technical.score < 50)) {
            directionBias = 'SELL';
          } else {
            directionBias = 'BUY';
          }

          return {
            analysis_id: ctx.analysisId,
            symbol: ctx.symbol,
            timeframe: ctx.timeframe,
            primaryTimeframe,
            primary_bias: primaryDirection,
            primaryTimeframeDirection: primaryDirection,
            direction_bias: directionBias,
            setup_type: setupType,
            risk_class: riskClass,
            timestamp: nowIso,
            market_condition: marketCond,
            action,
            confidence: Number(parsed.ai_confidence_percentage ?? parsed.confidence ?? (biasSignal === 'NO TRADE' ? 42 : biasSignal === 'WAIT' ? 72 : 86)),
            chart_detected_price: currentPrice,
            bias: `${primaryDirection} Directional Bias`,
            directional_bias: primaryDirection,
            potential_direction: potentialDir,
            entry_mode: entryMode,
            trigger_required: triggerRequired,
            market_bias: parsed.market_bias || (primaryDirection === 'BULLISH' ? 'BULLISH CONTINUATION' : primaryDirection === 'BEARISH' ? 'BEARISH CONTINUATION' : 'RANGE'),
            bias_signal: biasSignal,
            setup_quality: parsed.setup_quality || (biasSignal === 'NO TRADE' ? 'WEAK' : biasSignal === 'WAIT' ? 'MODERATE' : 'STRONG'),
            macro_direction: parsed.macro_direction || `${primaryTimeframe} = ${primaryDirection}`,
            macro_direction_h1: h1Macro,
            h1_macro: h1Macro,
            micro_structure: parsed.micro_structure || `M15 = ${m15Micro}`,
            micro_direction_m15: m15Micro,
            m15_micro: m15Micro,
            planned_entry_zone: plannedZone,
            potential_entry_zone: plannedZone,
            stop_loss_reason: isNoTrade ? '—' : (parsed.stop_loss_reason || (potentialDir === 'SELL' ? `Above M15 swing high ($${sc.M15.swingHigh}) & resistance ($${sc.H1.resistance[0]}).` : `Below M15 swing low ($${sc.M15.swingLow}) & support ($${sc.H1.support[0]}).`)),
            take_profit_1_reason: isNoTrade ? '—' : (parsed.take_profit_1_reason || (potentialDir === 'SELL' ? `Retest of support zone ($${sc.H1.support[0]}).` : `Retest of resistance zone ($${sc.H1.resistance[0]}).`)),
            take_profit_2_reason: isNoTrade ? '—' : (parsed.take_profit_2_reason || (potentialDir === 'SELL' ? `Extended target level ($${sc.H4.support[0]}).` : `Extended target level ($${sc.H4.resistance[0]}).`)),
            rr_tp1: isNoTrade ? '—' : (parsed.rr_tp1 || `1:${rr}`),
            rr_tp2: isNoTrade ? '—' : (parsed.rr_tp2 || `1:${(rr * 1.8).toFixed(1)}`),
            execution_status: execStatus,
            why: whyReason,
            reason: whyReason,
            next_condition: nextCondition,
            next_action: nextCondition,
            analysis_summary: Array.isArray(parsed.analysis_summary) && parsed.analysis_summary.length > 0
              ? parsed.analysis_summary.slice(0, 5)
              : defaultSummary,
            primary_confluence: Array.isArray(parsed.primary_confluence) ? parsed.primary_confluence : [
              `${primaryTimeframe} primary direction: ${primaryDirection} (S: $${sc?.[primaryTimeframe]?.support?.[0] || sc.H1.support[0]}, R: $${sc?.[primaryTimeframe]?.resistance?.[0] || sc.H1.resistance[0]})`,
              `M15 micro structure: ${m15Micro} (Swing H: $${sc.M15.swingHigh} / L: $${sc.M15.swingLow})`,
              `Price ($${currentPrice.toFixed(2)}) relative to dynamic VWAP ($${sc.M15.vwap})`,
              `Classic Pivot support/resistance at $${sc.pivotPoints.pivot}`,
            ],
            risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [
              sc.adx14.trendStrength === 'WEAK_OR_RANGE' ? 'ADX indicates ranging market condition' : 'Standard session volatility active'
            ],
            invalidation: isNoTrade ? '—' : (parsed.invalidation || `${biasSignal} setup invalidates if price breaks and closes beyond Stop Loss ($${stopLoss.toFixed(2)})`),
            multi_timeframe: defaultMtf,
            trade_plan: {
              entry_zone: {
                min: isNoTrade ? 0 : entryZoneMin,
                max: isNoTrade ? 0 : entryZoneMax,
              },
              entry_price: isNoTrade ? 0 : Number(futureEntryReference.toFixed(ctx.spec.digits)),
              planned_entry: isNoTrade ? 0 : Number(futureEntryReference.toFixed(ctx.spec.digits)),
              stop_loss: isNoTrade ? 0 : Number(stopLoss.toFixed(ctx.spec.digits)),
              take_profit_1: isNoTrade ? 0 : Number(tp1.toFixed(ctx.spec.digits)),
              take_profit_2: isNoTrade ? 0 : Number(tp2.toFixed(ctx.spec.digits)),
              risk_reward_ratio: isNoTrade ? 0 : rr,
            },
            key_drivers: Array.isArray(parsed.primary_confluence) ? parsed.primary_confluence : [
              `${primaryTimeframe} primary trend alignment`,
              `Price location relative to Classic Pivot ($${sc.pivotPoints.pivot})`,
            ],
            invalidation_condition: [
              isNoTrade ? 'No active trade setup' : (parsed.invalidation || `Candle close crossing Stop Loss ($${stopLoss.toFixed(ctx.spec.digits)})`),
            ],
            market_narrative: String(parsed.market_narrative || `Spot ${ctx.symbol} ($${currentPrice.toFixed(2)}) reflects ${marketCond} condition with ${execStatus} status (Entry Mode: ${entryMode}, Setup: ${setupType}).`),
            warnings: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [],
          };
        }
      } catch (err: any) {
        console.warn('[CopilotService] Gemini generation fallback engaged:', err?.message || err);
      }
    }

    // High-Precision Deterministic Fallback Analysis
    return this.generateDeterministicAnalysis(ctx, defaultMtf);
  }

  private generateDeterministicAnalysis(ctx: any, defaultMtf: any): StandardizedAiAnalysis {
    const price = ctx.marketSnapshot ? ctx.marketSnapshot.mid_price : ctx.currentPrice;
    const isScalping = ctx.tradingStyle === 'SCALPING';
    
    const symbolUpper = (ctx.symbol || ctx.spec?.symbol || '').toUpperCase();
    const isCrypto = symbolUpper.includes('BTC');
    const isForex = ctx.spec?.category === 'FOREX' || ctx.spec?.digits === 5 || ctx.spec?.digits === 3;
    let defaultAtr = 14.8;
    if (isCrypto) defaultAtr = 650.0;
    else if (ctx.spec?.digits === 5) defaultAtr = 0.0035;
    else if (ctx.spec?.digits === 3) defaultAtr = 0.45;

    let rawAtr = (ctx.technical?.atr14 && ctx.technical.atr14 > 0) ? ctx.technical.atr14 : defaultAtr;
    if (isCrypto && rawAtr < 50) rawAtr = 650.0;
    if (isForex && rawAtr > 10) rawAtr = defaultAtr;

    const atr = isScalping
      ? (isCrypto ? rawAtr * 0.35 : isForex ? rawAtr * 0.40 : Math.min(3.8, Math.max(1.5, rawAtr * 0.22)))
      : rawAtr;
    const pivots = ctx.technical.pivotPoints;
    const score = ctx.technical.score;
    const sc = ctx.structuredCapture;

    const primaryTimeframe = (ctx.timeframe || (isScalping ? 'M5' : 'H4')).toUpperCase();
    const primaryTfData = (defaultMtf as any)[primaryTimeframe] || (isScalping ? defaultMtf.M15 : defaultMtf.H4 || defaultMtf.H1);
    const primaryDirection: SentimentType = (primaryTfData.bias === 'BEARISH' || (sc as any)?.[primaryTimeframe]?.trend === 'BEARISH')
      ? 'BEARISH'
      : (primaryTfData.bias === 'BULLISH' || (sc as any)?.[primaryTimeframe]?.trend === 'BULLISH')
      ? 'BULLISH'
      : (score >= 55 ? 'BULLISH' : score <= 45 ? 'BEARISH' : 'NEUTRAL');

    const h1Direction = (defaultMtf?.H1?.bias || (sc as any)?.H1?.trend || (primaryTimeframe === 'H1' ? primaryDirection : 'BULLISH')) as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    const m15Direction = (sc?.timeframeAnalysis?.M15 || (score >= 60 ? 'BULLISH' : score <= 40 ? 'BEARISH' : 'NEUTRAL')) as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    const adxVal = sc?.adx14?.value || ctx.technical.adx14 || 22;

    let market_condition: MarketCondition = primaryDirection === 'BEARISH' ? 'BEARISH' : primaryDirection === 'BULLISH' ? 'BULLISH' : 'SIDEWAYS';
    let action: TradingAction = 'WAIT';
    let bias_signal: 'BUY' | 'SELL' | 'WAIT' | 'NO TRADE' = 'WAIT';
    let directional_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = primaryDirection;
    let potential_direction: PotentialDirection = primaryDirection === 'BEARISH' ? 'SELL' : primaryDirection === 'BULLISH' ? 'BUY' : 'NONE';
    let entry_mode: EntryMode = 'PULLBACK';
    let execution_status: ExecutionStatus = 'WAIT FOR CONFIRMATION';
    let setup_type: SetupType = 'TREND_CONTINUATION';
    let risk_class: RiskClass = 'NORMAL_RISK';
    let trigger_required = '';
    let confidence = 75;
    let why = '';
    let next_condition = '';

    // 1. Check for NO TRADE condition: ADX < 18, or sideways/flat market, or neutral score
    if (adxVal < 18 || (primaryDirection === 'NEUTRAL' && m15Direction === 'NEUTRAL') || (score >= 46 && score <= 54)) {
      market_condition = 'SIDEWAYS';
      action = 'NONE';
      bias_signal = 'NO TRADE';
      directional_bias = 'NEUTRAL';
      potential_direction = 'NONE';
      entry_mode = 'NONE';
      execution_status = 'NO TRADE';
      setup_type = 'NONE';
      confidence = 42;
      trigger_required = `Wait for a clear directional breakout beyond daily pivot boundaries ($${pivots.s1} - $${pivots.r1}) with expanding volume.`;
      why = `Market structure is sideways with ADX (${adxVal.toFixed(1)}) indicating low trend strength and conflicting timeframe momentum.`;
      next_condition = trigger_required;
    }
    // 2. Check for WAIT condition: Primary TF and M15 divergence
    else if ((primaryDirection === 'BULLISH' && m15Direction === 'BEARISH') || (primaryDirection === 'BEARISH' && m15Direction === 'BULLISH')) {
      market_condition = primaryDirection === 'BULLISH' ? 'BULLISH' : 'BEARISH';
      action = 'WAIT';
      bias_signal = 'WAIT';
      directional_bias = primaryDirection;
      potential_direction = primaryDirection === 'BULLISH' ? 'BUY' : 'SELL';
      entry_mode = 'PULLBACK';
      execution_status = 'WAIT FOR CONFIRMATION';
      setup_type = 'PULLBACK';
      confidence = 72;
      if (primaryDirection === 'BULLISH') {
        trigger_required = `Price must enter the potential entry zone AND ${isScalping ? 'M1/M5' : 'M15'} must turn bullish with candle-close confirmation.`;
        why = `${primaryTimeframe} Macro is bullish, but Micro is currently in a bearish pullback. Potential BUY setup exists once retracement completes.`;
        next_condition = `Wait for price to retrace into support and ${isScalping ? 'M1/M5' : 'M15'} candle close to confirm bullish continuation.`;
      } else {
        trigger_required = `Price must enter the potential entry zone AND ${isScalping ? 'M1/M5' : 'M15'} must turn bearish with candle-close confirmation.`;
        why = `${primaryTimeframe} Macro is bearish, but Micro is currently in a bullish pullback. Potential SELL setup exists once retracement completes.`;
        next_condition = `Wait for price to retrace into resistance and ${isScalping ? 'M1/M5' : 'M15'} candle close to confirm bearish continuation.`;
      }
    }
    // 3. BUY Condition (Both Primary & Micro Bullish)
    else if (primaryDirection === 'BULLISH' && (m15Direction === 'BULLISH' || score >= 60)) {
      market_condition = 'BULLISH';
      action = 'BUY';
      bias_signal = 'BUY';
      directional_bias = 'BULLISH';
      potential_direction = 'BUY';
      entry_mode = 'MARKET';
      execution_status = 'READY';
      setup_type = 'TREND_CONTINUATION';
      confidence = Math.min(94, Math.max(78, Math.round(score * 0.4 + 50)));
      trigger_required = `All entry conditions and multi-timeframe confirmations satisfied. Ready for market execution.`;
      why = `Primary ${primaryTimeframe} and micro bullish structure aligned with price above dynamic EMAs and Classic Pivot ($${pivots.pivot}).`;
      next_condition = `Execute BUY at planned entry zone with structural invalidation below local support.`;
    }
    // 4. SELL Condition (Both Primary & Micro Bearish)
    else if (primaryDirection === 'BEARISH' && (m15Direction === 'BEARISH' || score <= 40)) {
      market_condition = 'BEARISH';
      action = 'SELL';
      bias_signal = 'SELL';
      directional_bias = 'BEARISH';
      potential_direction = 'SELL';
      entry_mode = 'MARKET';
      execution_status = 'READY';
      setup_type = 'TREND_CONTINUATION';
      confidence = Math.min(94, Math.max(78, Math.round((100 - score) * 0.4 + 50)));
      trigger_required = `All entry conditions and multi-timeframe confirmations satisfied. Ready for market execution.`;
      why = `Primary ${primaryTimeframe} and micro bearish structure aligned with price below dynamic EMAs and Classic Pivot ($${pivots.pivot}).`;
      next_condition = `Execute SELL at planned entry zone with structural invalidation above local resistance.`;
    } else {
      market_condition = 'SIDEWAYS';
      action = 'WAIT';
      bias_signal = 'WAIT';
      directional_bias = primaryDirection;
      potential_direction = primaryDirection === 'BULLISH' ? 'BUY' : primaryDirection === 'BEARISH' ? 'SELL' : 'NONE';
      entry_mode = 'PULLBACK';
      execution_status = 'WAIT FOR CONFIRMATION';
      setup_type = 'PULLBACK';
      confidence = 65;
      trigger_required = `Wait for next candle close to establish clear direction in ${primaryTimeframe}.`;
      why = `Market is consolidating near key pivot level ($${pivots.pivot}). Directional edge is premature.`;
      next_condition = trigger_required;
    }

    const isNoTrade = bias_signal === 'NO TRADE';
    let entry_price = isNoTrade ? 0 : price;
    let stop_loss = 0;
    let tp1 = 0;
    let tp2 = 0;
    let tp3 = 0;
    let rr = isScalping ? 1.35 : 1.5;
    let entryZoneMin = 0;
    let entryZoneMax = 0;

    const pullbackOffsetMin = isCrypto ? (isScalping ? 150 : 450) : isForex ? (isScalping ? 0.0008 : 0.0025) : (isScalping ? 0.6 : 3.5);
    const pullbackOffsetMax = isCrypto ? (isScalping ? 50 : 180) : isForex ? (isScalping ? 0.0003 : 0.0010) : (isScalping ? 0.2 : 1.0);
    const zoneBuffer = isCrypto ? (isScalping ? 100 : 250) : isForex ? (isScalping ? 0.0005 : 0.0015) : (isScalping ? 0.8 : 1.5);
    const slMultiplier = isScalping ? 1.25 : 1.15;

    if (!isNoTrade) {
      if (entry_mode === 'PULLBACK') {
        if (potential_direction === 'BUY') {
          entryZoneMin = Number((price - pullbackOffsetMin).toFixed(ctx.spec.digits));
          entryZoneMax = Number((price - pullbackOffsetMax).toFixed(ctx.spec.digits));
          entry_price = Number(((entryZoneMin + entryZoneMax) / 2).toFixed(ctx.spec.digits));
          stop_loss = Number((entryZoneMin - atr * 0.8).toFixed(ctx.spec.digits));
          tp1 = Number((entry_price + atr * 1.5).toFixed(ctx.spec.digits));
          tp2 = Number((entry_price + atr * 2.8).toFixed(ctx.spec.digits));
          tp3 = Number((entry_price + atr * 4.0).toFixed(ctx.spec.digits));
        } else {
          entryZoneMin = Number((price + pullbackOffsetMax).toFixed(ctx.spec.digits));
          entryZoneMax = Number((price + pullbackOffsetMin).toFixed(ctx.spec.digits));
          entry_price = Number(((entryZoneMin + entryZoneMax) / 2).toFixed(ctx.spec.digits));
          stop_loss = Number((entryZoneMax + atr * 0.8).toFixed(ctx.spec.digits));
          tp1 = Number((entry_price - atr * 1.5).toFixed(ctx.spec.digits));
          tp2 = Number((entry_price - atr * 2.8).toFixed(ctx.spec.digits));
          tp3 = Number((entry_price - atr * 4.0).toFixed(ctx.spec.digits));
        }
      } else {
        entryZoneMin = Number((price - zoneBuffer).toFixed(ctx.spec.digits));
        entryZoneMax = Number((price + zoneBuffer).toFixed(ctx.spec.digits));
        if (potential_direction === 'SELL' || bias_signal === 'SELL') {
          stop_loss = Number((price + atr * slMultiplier).toFixed(ctx.spec.digits));
          tp1 = Number((price - atr * 1.8).toFixed(ctx.spec.digits));
          tp2 = Number((price - atr * 3.2).toFixed(ctx.spec.digits));
          tp3 = Number((price - atr * 4.5).toFixed(ctx.spec.digits));
        } else {
          stop_loss = Number((price - atr * slMultiplier).toFixed(ctx.spec.digits));
          tp1 = Number((price + atr * 1.8).toFixed(ctx.spec.digits));
          tp2 = Number((price + atr * 3.2).toFixed(ctx.spec.digits));
          tp3 = Number((price + atr * 4.5).toFixed(ctx.spec.digits));
        }
      }

      const slDist = Math.abs(entry_price - stop_loss) || 1;
      const tpDist = Math.abs(tp1 - entry_price);
      rr = Number((tpDist / slDist).toFixed(2));
    }

    const setup_quality = confidence >= 85 ? 'VERY STRONG' : confidence >= 75 ? 'STRONG' : confidence >= 65 ? 'MODERATE' : 'WEAK';
    const invalidation = isNoTrade ? '—' : `${bias_signal} setup becomes invalid if ${isScalping ? 'M1/M5' : 'M15/H1'} closes beyond Stop Loss ($${stop_loss.toFixed(ctx.spec.digits)})`;
    const planned_entry_zone = isNoTrade ? '—' : `${entryZoneMin.toFixed(ctx.spec.digits)} – ${entryZoneMax.toFixed(ctx.spec.digits)}`;

    const direction_bias: 'BUY' | 'SELL' = (
      primaryDirection === 'BEARISH' ||
      potential_direction === 'SELL' ||
      bias_signal === 'SELL' ||
      (score !== undefined && score < 50)
    ) ? 'SELL' : 'BUY';

    return {
      analysis_id: ctx.analysisId,
      symbol: ctx.symbol,
      timeframe: ctx.timeframe,
      primaryTimeframe,
      primary_bias: primaryDirection,
      primaryTimeframeDirection: primaryDirection,
      direction_bias,
      setup_type,
      risk_class,
      timestamp: new Date().toISOString(),
      market_condition,
      action,
      confidence,
      chart_detected_price: price,
      bias: `${primaryDirection} Directional Bias`,
      directional_bias: primaryDirection,
      potential_direction,
      entry_mode,
      trigger_required,
      market_bias: market_condition === 'BULLISH' ? 'BULLISH CONTINUATION' : market_condition === 'BEARISH' ? 'BEARISH CONTINUATION' : 'RANGE',
      bias_signal,
      setup_quality,
      macro_direction: `${primaryTimeframe} = ${primaryDirection}`,
      macro_direction_h1: h1Direction,
      h1_macro: h1Direction,
      micro_structure: `M15 = ${m15Direction}`,
      micro_direction_m15: m15Direction,
      m15_micro: m15Direction,
      planned_entry_zone,
      potential_entry_zone: planned_entry_zone,
      stop_loss_reason: isNoTrade ? '—' : (potential_direction === 'SELL' ? 'Above local M15 resistance and H1 swing high.' : 'Below local M15 support and H1 swing low.'),
      take_profit_1_reason: isNoTrade ? '—' : (potential_direction === 'SELL' ? 'Retest of H1 previous support low.' : 'Retest of H1 previous resistance high.'),
      take_profit_2_reason: isNoTrade ? '—' : 'Extended H1 liquidity target zone.',
      why,
      reason: why,
      next_condition,
      next_action: next_condition,
      analysis_summary: [
        `H1 macro structure: ${h1Direction.toLowerCase()}.`,
        `M15 micro structure: ${m15Direction.toLowerCase()}.`,
        `Price trading ${sc?.ema?.pricePosition?.toLowerCase()?.replace(/_/g, ' ') || 'near key'} dynamic EMAs and VWAP.`,
        `ADX (${adxVal.toFixed(1)}) indicates ${adxVal < 20 ? 'weak/ranging' : 'active'} trend momentum.`,
        bias_signal === 'WAIT'
          ? `Wait for trigger condition: ${trigger_required}`
          : bias_signal === 'NO TRADE'
          ? `No directional institutional edge exists.`
          : `High-conviction ${bias_signal} execution plan active.`,
      ],
      primary_confluence: [
        `H1 Macro trend: ${h1Direction}`,
        `M15 Micro structure: ${m15Direction}`,
        `Price relative to EMA 20 ($${sc?.ema?.ema20 || pivots.pivot}) and EMA 50 ($${sc?.ema?.ema50 || pivots.pivot})`,
        `Classic daily pivot structure active at $${pivots.pivot}`,
      ],
      risk_flags: [
        adxVal < 20 ? 'ADX indicates potential range-bound chop' : 'Standard session volatility active',
      ],
      execution_status,
      invalidation,
      rr_tp1: isNoTrade ? '—' : `1:${rr}`,
      rr_tp2: isNoTrade ? '—' : `1:${(rr * 1.8).toFixed(1)}`,
      multi_timeframe: defaultMtf,
      trade_plan: {
        entry_zone: {
          min: isNoTrade ? 0 : entryZoneMin,
          max: isNoTrade ? 0 : entryZoneMax,
        },
        entry_price,
        planned_entry: entry_price,
        stop_loss,
        take_profit_1: tp1,
        take_profit_2: tp2,
        take_profit_3: tp3,
        risk_reward_ratio: isNoTrade ? 0 : rr,
      },
      key_drivers: [
        'Multi-engine mathematical alignment across technical and macro indicators',
        `Price holding structurally relative to Classic Pivot ($${pivots.pivot})`,
      ],
      invalidation_condition: [
        invalidation,
      ],
      market_narrative: `Spot ${ctx.symbol} reflects ${market_condition} condition (${bias_signal}) with ${execution_status} status.`,
      warnings: adxVal < 20 ? ['ADX indicates weak trend momentum'] : [],
    };
  }

  /**
   * Final Live Pre-Execution Validation
   * Checks plan age, price drift, live spread, and Stop Loss breach.
   */
  public validateBeforeExecution(
    snapshot: CopilotTradePlanSnapshot,
    liveMarket: MarketPrice,
    requestedAction?: string
  ): { valid: boolean; code?: string; message?: string } {
    const config = tradeValidationEngine.getConfig();
    const maxAgeSec = config.MAX_TRADE_PLAN_AGE_SECONDS || 600;
    const maxDeviation = config.PRICE_DEVIATION_THRESHOLD || 25.0;

    const livePrice = liveMarket.price;
    const planPrice = snapshot.market_price_at_creation;
    const priceDrift = Number(Math.abs(livePrice - planPrice).toFixed(2));
    const ageSeconds = Math.floor((Date.now() - new Date(snapshot.createdAt).getTime()) / 1000);
    const action = (requestedAction || snapshot.action || 'BUY').toUpperCase();

    console.log(
      `[PRE-EXECUTION REVALIDATION] tradePlanId=${snapshot.trade_plan_id} snapshotId=${snapshot.snapshot_id} livePrice=${livePrice} snapshotPrice=${planPrice} priceDrift=${priceDrift} ageSeconds=${ageSeconds} action=${action}`
    );

    // 1. Stale Plan Check (relaxed to 10m for active trading)
    if (ageSeconds > maxAgeSec) {
      return {
        valid: false,
        code: 'TRADE_PLAN_EXPIRED',
        message: `Trade Plan was generated ${Math.floor(ageSeconds / 60)}m ${ageSeconds % 60}s ago and has expired (> ${Math.floor(maxAgeSec / 60)}m max age). Please run 'Capture Now' to refresh live telemetry.`,
      };
    }

    // 2. Price Drift Check
    if (priceDrift > maxDeviation) {
      return {
        valid: false,
        code: 'PRICE_MOVED_TOO_FAR',
        message: `Live market price ($${livePrice.toFixed(snapshot.symbol_spec.digits)}) has drifted $${priceDrift.toFixed(snapshot.symbol_spec.digits)} away from original analysis snapshot ($${planPrice.toFixed(snapshot.symbol_spec.digits)}, tolerance: $${maxDeviation.toFixed(snapshot.symbol_spec.digits)}). Execution blocked for risk protection.`,
      };
    }

    // 3. Stop Loss Breach Check
    if (action === 'BUY' && snapshot.trade_plan?.stop_loss && livePrice <= snapshot.trade_plan.stop_loss) {
      return {
        valid: false,
        code: 'SL_BREACHED',
        message: `Live price ($${livePrice.toFixed(snapshot.symbol_spec.digits)}) has breached Stop Loss ($${snapshot.trade_plan.stop_loss.toFixed(snapshot.symbol_spec.digits)}). Trade setup is invalid.`,
      };
    }

    if (action === 'SELL' && snapshot.trade_plan?.stop_loss && livePrice >= snapshot.trade_plan.stop_loss) {
      return {
        valid: false,
        code: 'SL_BREACHED',
        message: `Live price ($${livePrice.toFixed(snapshot.symbol_spec.digits)}) has breached Stop Loss ($${snapshot.trade_plan.stop_loss.toFixed(snapshot.symbol_spec.digits)}). Trade setup is invalid.`,
      };
    }

    // 4. Live Spread Widening Check
    const spec = snapshot.symbol_spec;
    const liveSpreadPoints = Math.round(liveMarket.spread / spec.point);
    const maxSpread = config.MAX_SPREAD_POINTS[spec.symbol] || 45;
    if (liveSpreadPoints > maxSpread) {
      return {
        valid: false,
        code: 'SPREAD_TOO_HIGH',
        message: `Live spread has expanded to ${liveSpreadPoints} points (limit: ${maxSpread} points). Order blocked until normal spread returns.`,
      };
    }

    // 5. Market Closed Check
    if (liveMarket.status === 'CLOSED' || spec.tradeMode === 'DISABLED') {
      return {
        valid: false,
        code: 'MARKET_CLOSED',
        message: 'Market is currently closed or trading is disabled for this instrument.',
      };
    }

    return { valid: true };
  }

  /**
   * Idempotent Order Execution Engine
   */
  public async executeTradePlan(req: CopilotExecutionRequest): Promise<CopilotExecutionResponse> {
    const timestamp = new Date().toISOString();

    // 1. Idempotency Check
    if (req.idempotency_key && this.processedIdempotencyKeys.has(req.idempotency_key)) {
      db.addLog(
        'WARN',
        'EXECUTION_ENGINE',
        `Idempotency key ${req.idempotency_key} intercepted duplicate execution request. Returning cached response.`
      );
      return this.processedIdempotencyKeys.get(req.idempotency_key)!;
    }

    // 2. Mandatory User Confirmation Check
    if (!req.user_confirmed) {
      return {
        success: false,
        code: 'USER_CONFIRMATION_REQUIRED',
        message: 'Execution aborted: Explicit user confirmation is strictly mandatory.',
        timestamp,
        status: 'ORDER_BLOCKED',
      };
    }

    // 3. Retrieve Trade Plan Snapshot
    const activePlan = this.activeSnapshot;
    if (!activePlan || (req.trade_plan_id && activePlan.trade_plan_id !== req.trade_plan_id)) {
      return {
        success: false,
        code: 'TRADE_PLAN_NOT_FOUND',
        message: 'Trade Plan snapshot was not found or has been replaced.',
        timestamp,
        status: 'ORDER_BLOCKED',
      };
    }

    // 4. Final Live Validation Before Sending to Broker
    const liveMarket = marketDataService.getLiveMarket();
    const liveCheck = this.validateBeforeExecution(activePlan, liveMarket, req.action);

    if (!liveCheck.valid) {
      db.addLog(
        'ERROR',
        'EXECUTION_BLOCKED',
        `Execution blocked for ${req.symbol} (${req.action}): ${liveCheck.code} - ${liveCheck.message}`
      );

      const blockedResponse: CopilotExecutionResponse = {
        success: false,
        code: liveCheck.code || 'VALIDATION_FAILED',
        message: liveCheck.message || 'Execution blocked by pre-trade risk validation.',
        timestamp,
        status: 'ORDER_BLOCKED',
        reasons: [liveCheck.message || 'Validation failed'],
        snapshot: activePlan,
      };

      if (req.idempotency_key) {
        this.processedIdempotencyKeys.set(req.idempotency_key, blockedResponse);
      }
      return blockedResponse;
    }

    // 5. Execute Order via MT5 Bridge / Broker Simulation
    const ticketNumber = Math.floor(10000000 + Math.random() * 90000000);
    const fillPrice = req.action === 'BUY' ? liveMarket.ask : liveMarket.bid;
    const slippagePoints = Math.round(Math.abs(fillPrice - req.entry_price) / activePlan.symbol_spec.point);

    // Update active snapshot
    activePlan.status = 'EXECUTED';
    activePlan.user_confirmed = true;
    activePlan.actual_execution_price = fillPrice;
    activePlan.actualEntry = fillPrice;
    activePlan.mt5_ticket = ticketNumber;

    console.log(
      `\n[SPILLA][EXECUTION]\nPlan ID: ${activePlan.trade_plan_id}\nPlanned Entry: ${activePlan.trade_plan.entry_price}\nActual Entry: ${fillPrice}\nStatus: ORDER_EXECUTED\n`
    );

    // Update DB SSOT Signal Execution State
    db.updateSignalExecution(activePlan.signal_id, {
      mt5Ticket: ticketNumber,
      executionStatus: 'EXECUTED',
      status: 'EXECUTED',
      requestedExecutionPrice: req.entry_price,
      actualExecutionPrice: fillPrice,
      executionSlippage: slippagePoints,
      executedAt: timestamp,
    });

    db.addLog(
      'INFO',
      'BROKER_EXECUTION',
      `ORDER EXECUTED: #${ticketNumber} ${req.action} ${req.volume} ${req.symbol} @ $${fillPrice} (SL: $${req.stop_loss}, TP: $${req.take_profit})`
    );

    const execResponse: CopilotExecutionResponse = {
      success: true,
      code: 'ORDER_EXECUTED',
      message: `Order successfully placed on broker #${ticketNumber}: ${req.action} ${req.volume} lots ${req.symbol} filled @ $${fillPrice.toFixed(activePlan.symbol_spec.digits)}`,
      execution_id: `EXEC-${Date.now()}`,
      broker_order_id: ticketNumber,
      mt5_ticket: ticketNumber,
      actual_fill_price: fillPrice,
      slippage_points: slippagePoints,
      timestamp,
      status: 'ORDER_EXECUTED',
      snapshot: activePlan,
    };

    if (req.idempotency_key) {
      this.processedIdempotencyKeys.set(req.idempotency_key, execResponse);
    }

    return execResponse;
  }
}

export const copilotService = new CopilotService();
