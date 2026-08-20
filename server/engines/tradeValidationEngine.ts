import {
  TradeEligibilityResult,
  ValidationChecks,
  StandardizedAiAnalysis,
  PositionSizingResult,
  CopilotConfig,
  SymbolSpecification,
  MarketPrice,
} from '../../src/types.js';
import { collectorManager } from '../collectors/index.js';
import { symbolService } from '../services/symbolService.js';

export class TradeValidationEngine {
  private config: CopilotConfig = {
    AI_MIN_CONFIDENCE: 65,
    MIN_RISK_REWARD: 1.5,
    MAX_SPREAD_POINTS: {
      XAUUSD: 45,
      'XAUUSD.cent': 45,
      EURUSD: 25,
      GBPUSD: 30,
      USDJPY: 25,
      BTCUSD: 5000,
    },
    NEWS_BLACKOUT_MINUTES: 30,
    MAX_DAILY_LOSS_PERCENT: 5.0,
    MAX_OPEN_POSITIONS: 5,
    MAX_RISK_PERCENT: 3.0,
    DEFAULT_RISK_PERCENT: 1.0,
    DEFAULT_ACCOUNT_EQUITY: 10000,
    DEFAULT_POSITION_SIZING_MODE: 'RISK_PERCENT',
    PRICE_DEVIATION_THRESHOLD: 12.0,
    MAX_TRADE_PLAN_AGE_SECONDS: 300,
  };

  public getConfig(): CopilotConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<CopilotConfig>): CopilotConfig {
    this.config = {
      ...this.config,
      ...newConfig,
      MAX_SPREAD_POINTS: {
        ...this.config.MAX_SPREAD_POINTS,
        ...(newConfig.MAX_SPREAD_POINTS || {}),
      },
    };
    return this.config;
  }

  /**
   * Evaluates if a proposed Trade Plan is stale based on elapsed time or market price deviation.
   */
  public validateStaleness(
    planCreatedAt: string | Date,
    planSnapshotPrice: number,
    currentLivePrice: number,
    customThreshold?: number,
    customMaxAgeSec?: number
  ): { isStale: boolean; code?: string; reason?: string; priceDrift: number; ageSeconds: number } {
    const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(planCreatedAt).getTime()) / 1000));
    const priceDrift = Number(Math.abs(currentLivePrice - planSnapshotPrice).toFixed(2));
    const threshold = customThreshold ?? this.config.PRICE_DEVIATION_THRESHOLD ?? 12.0;
    const maxAgeSec = customMaxAgeSec ?? this.config.MAX_TRADE_PLAN_AGE_SECONDS ?? 300;

    if (ageSeconds > maxAgeSec) {
      return {
        isStale: true,
        code: 'TRADE_PLAN_EXPIRED',
        reason: `Trade Plan expired (${Math.floor(ageSeconds / 60)}m ${ageSeconds % 60}s old > max allowed ${Math.floor(maxAgeSec / 60)}m). Fresh snapshot required.`,
        priceDrift,
        ageSeconds,
      };
    }

    if (priceDrift > threshold) {
      return {
        isStale: true,
        code: 'PRICE_MOVED_TOO_FAR',
        reason: `Market moved $${priceDrift.toFixed(2)} from analysis snapshot ($${planSnapshotPrice.toFixed(2)} -> $${currentLivePrice.toFixed(2)}, tolerance: $${threshold.toFixed(2)}). Trade plan expired.`,
        priceDrift,
        ageSeconds,
      };
    }

    return {
      isStale: false,
      priceDrift,
      ageSeconds,
    };
  }

  /**
   * Deterministically validates an AI proposed Trade Plan against strict quantitative risk guardrails.
   */
  public validate(
    analysis: StandardizedAiAnalysis,
    positionSizing: PositionSizingResult,
    liveMarket: MarketPrice,
    symbolSpec?: SymbolSpecification
  ): TradeEligibilityResult {
    const spec = symbolSpec || symbolService.getSymbol(analysis.symbol);
    const reasons: string[] = [];
    const codes: string[] = [];

    const checks: ValidationChecks = {
      confidence: 'PASS',
      risk_reward: 'PASS',
      spread: 'PASS',
      news: 'PASS',
      multi_timeframe: 'PASS',
      market_session: 'PASS',
      margin: 'PASS',
    };

    let eligible = true;

    // 1. Action & Condition Check
    if (analysis.action === 'NONE' || analysis.market_condition === 'NO_TRADE') {
      eligible = false;
      codes.push('NO_TRADE_ACTION');
      reasons.push(
        analysis.action === 'NONE'
          ? 'AI Engine determined market does not present an actionable trade setup (Action: NONE).'
          : 'Market Condition evaluated as NO_TRADE / Chop.'
      );
    }

    // 2. AI Confidence Threshold Check
    if (analysis.confidence < this.config.AI_MIN_CONFIDENCE) {
      eligible = false;
      checks.confidence = 'FAIL';
      codes.push('LOW_AI_CONFIDENCE');
      reasons.push(
        `AI Confidence score (${analysis.confidence}%) is below the minimum mandatory threshold (${this.config.AI_MIN_CONFIDENCE}%).`
      );
    }

    // 3. Risk-to-Reward Ratio Check
    const minRequiredRR = analysis.tradingStyle === 'SCALPING' ? 1.2 : this.config.MIN_RISK_REWARD;
    const rr = analysis.trade_plan.risk_reward_ratio;
    if (analysis.action !== 'NONE') {
      if (rr < minRequiredRR) {
        eligible = false;
        checks.risk_reward = 'FAIL';
        codes.push('LOW_RISK_REWARD');
        reasons.push(
          `Risk/Reward ratio (1:${rr.toFixed(2)}) is below the required minimum efficiency of 1:${minRequiredRR.toFixed(2)} for ${analysis.tradingStyle || 'INTRADAY'}.`
        );
      }
    }

    // 4. Live Spread Threshold Check
    const maxAllowedSpreadPoints =
      this.config.MAX_SPREAD_POINTS[spec.symbol] || spec.maxSpreadPoints || 45;
    const spreadInPoints = Math.round(liveMarket.spread / spec.point);

    if (spreadInPoints > maxAllowedSpreadPoints) {
      eligible = false;
      checks.spread = 'FAIL';
      codes.push('SPREAD_TOO_HIGH');
      reasons.push(
        `Live broker spread (${spreadInPoints} pts) exceeds maximum permitted risk limit (${maxAllowedSpreadPoints} pts).`
      );
    }

    // 5. High-Impact News Blackout Window Check
    const collectorData = collectorManager.getAllCollectorData();
    const highImpactEvents = (collectorData.calendarEvents || []).filter(
      (e) => e.impact === 'HIGH'
    );

    // If there is any high-impact event within blackout window (or explicitly flagged)
    const blackoutMinutes = this.config.NEWS_BLACKOUT_MINUTES;
    const activeBlackoutEvent = highImpactEvents.find((evt) => {
      // Check event name keywords like FOMC, CPI, NFP, Fed
      const isCritical =
        evt.event.includes('CPI') ||
        evt.event.includes('FOMC') ||
        evt.event.includes('Fed') ||
        evt.event.includes('Payrolls') ||
        evt.event.includes('Rate');
      return isCritical;
    });

    // Check if collector risk or simulation indicates news window proximity < blackoutMinutes
    if (activeBlackoutEvent && blackoutMinutes > 0) {
      // In production, compare event.time with current UTC time
      // For testing & hardening, if risk score reports critical news window, flag it
      const hasProximity = (collectorData.macroData as any)?.newsProximityMinutes
        ? (collectorData.macroData as any).newsProximityMinutes <= blackoutMinutes
        : false;

      if (hasProximity) {
        eligible = false;
        checks.news = 'FAIL';
        codes.push('NEWS_BLACKOUT');
        reasons.push(
          `High-impact economic release '${activeBlackoutEvent.event}' scheduled within the ${blackoutMinutes}-minute news blackout window.`
        );
      }
    }

    // 6. Multi-Timeframe & Primary Directional Gate Check
    const mtf = analysis.multi_timeframe;
    const primaryDir = analysis.primaryTimeframeDirection || analysis.primary_bias || (analysis.primaryTimeframe === 'D1' ? mtf?.D1?.bias : analysis.primaryTimeframe === 'H4' ? mtf?.H4?.bias : analysis.primaryTimeframe === 'M15' ? mtf?.M15?.bias : mtf?.H1?.bias);

    if (analysis.action === 'BUY') {
      if (primaryDir === 'BEARISH' && analysis.setup_type !== 'COUNTER-TREND') {
        eligible = false;
        checks.multi_timeframe = 'FAIL';
        codes.push('PRIMARY_GATE_CONFLICT');
        reasons.push(
          `Primary Direction Gate violation: Selected timeframe (${analysis.primaryTimeframe || 'Primary'}) is BEARISH, prohibiting standard BUY recommendations without explicit COUNTER-TREND classification.`
        );
      } else {
        const higherTimeframeBearish =
          mtf?.D1?.bias === 'BEARISH' && mtf?.H4?.bias === 'BEARISH';
        if (higherTimeframeBearish && analysis.setup_type !== 'COUNTER-TREND') {
          eligible = false;
          checks.multi_timeframe = 'FAIL';
          codes.push('MTF_CONFLICT');
          reasons.push(
            'Major Multi-Timeframe conflict: D1 and H4 Higher Timeframes are strongly BEARISH, invalidating standard BUY setup.'
          );
        } else if (mtf?.D1?.bias === 'BEARISH' || mtf?.H4?.bias === 'BEARISH') {
          checks.multi_timeframe = 'WARNING';
          reasons.push(
            'Multi-timeframe divergence noted between short-term momentum (M15) and macro trend (D1).'
          );
        }
      }
    } else if (analysis.action === 'SELL') {
      if (primaryDir === 'BULLISH' && analysis.setup_type !== 'COUNTER-TREND') {
        eligible = false;
        checks.multi_timeframe = 'FAIL';
        codes.push('PRIMARY_GATE_CONFLICT');
        reasons.push(
          `Primary Direction Gate violation: Selected timeframe (${analysis.primaryTimeframe || 'Primary'}) is BULLISH, prohibiting standard SELL recommendations without explicit COUNTER-TREND classification.`
        );
      } else {
        const higherTimeframeBullish =
          mtf?.D1?.bias === 'BULLISH' && mtf?.H4?.bias === 'BULLISH';
        if (higherTimeframeBullish && analysis.setup_type !== 'COUNTER-TREND') {
          eligible = false;
          checks.multi_timeframe = 'FAIL';
          codes.push('MTF_CONFLICT');
          reasons.push(
            'Major Multi-Timeframe conflict: D1 and H4 Higher Timeframes are strongly BULLISH, invalidating standard SELL setup.'
          );
        } else if (mtf?.D1?.bias === 'BULLISH' || mtf?.H4?.bias === 'BULLISH') {
          checks.multi_timeframe = 'WARNING';
          reasons.push(
            'Multi-timeframe divergence noted between short-term momentum (M15) and macro trend (D1).'
          );
        }
      }
    }

    // 7. Market Session & Tradability Check
    if (liveMarket.status === 'CLOSED' || spec.tradeMode === 'DISABLED') {
      eligible = false;
      checks.market_session = 'FAIL';
      codes.push('MARKET_CLOSED');
      reasons.push('Market session is currently CLOSED or symbol trading mode is disabled by broker.');
    }

    // 8. Margin & Position Sizing Guardrails Check
    if (!positionSizing.lot_validation.valid) {
      eligible = false;
      checks.margin = 'FAIL';
      codes.push('RISK_LIMIT_EXCEEDED');
      reasons.push(
        positionSizing.lot_validation.reason ||
          'Calculated position size violates account risk or margin constraints.'
      );
    }

    return {
      eligible,
      status: eligible ? 'APPROVED' : 'NO_TRADE',
      reasons: reasons.length > 0 ? reasons : ['All deterministic quantitative and risk validation checks passed.'],
      codes,
      checks,
    };
  }
}

export const tradeValidationEngine = new TradeValidationEngine();
