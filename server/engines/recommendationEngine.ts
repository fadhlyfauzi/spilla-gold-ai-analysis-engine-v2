import {
  RecommendationResponse,
  SignalType,
  TradeSetup,
} from '../../src/types.js';
import { marketDataService } from '../services/marketDataService.js';
import { symbolService } from '../services/symbolService.js';
import { fundamentalEngine } from './fundamentalEngine.js';
import { technicalEngine } from './technicalEngine.js';
import { sentimentEngine } from './sentimentEngine.js';
import { riskEngine } from './riskEngine.js';
import { aiConfidenceEngine } from './aiConfidenceEngine.js';
import { db } from '../db/database.js';

export class RecommendationEngine {
  public async generateRecommendation(symbolParam = 'XAUUSD'): Promise<RecommendationResponse> {
    const resolved = symbolService.resolveSymbol(symbolParam);
    const canonical = resolved.canonicalSymbol;
    const digits = resolved.spec.digits || 2;
    const price = marketDataService.getCurrentPrice(canonical);
    const validation = marketDataService.validateSync(canonical);

    const fundamental = fundamentalEngine.calculateScore();
    const technical = technicalEngine.calculateScore();
    const sentiment = sentimentEngine.calculateScore();
    const risk = riskEngine.calculateScore();

    const aiConfidence = await aiConfidenceEngine.evaluate(
      fundamental,
      technical,
      sentiment,
      risk,
      price
    );

    // Weighted composite signal calculator
    const compositeScore =
      fundamental.score * 0.30 +
      technical.score * 0.35 +
      sentiment.score * 0.20 +
      aiConfidence.score * 0.15;

    let recommendation: SignalType = 'WAIT';
    if (compositeScore >= 80 && risk.score < 60) recommendation = 'STRONG_BUY';
    else if (compositeScore >= 65 && risk.score < 75) recommendation = 'BUY';
    else if (compositeScore <= 20 && risk.score < 60) recommendation = 'STRONG_SELL';
    else if (compositeScore <= 35 && risk.score < 75) recommendation = 'SELL';
    else recommendation = 'WAIT';

    // Calculate Trade Setup parameters
    const isCrypto = canonical.includes('BTC');
    const isForex = digits === 5 || digits === 3;
    const defaultATR = isCrypto ? 450.0 : isForex ? (digits === 3 ? 0.45 : 0.0035) : 14.8;
    const atr = technical.atr14 || defaultATR;
    const pivot = technical.pivotPoints;

    let entryPrice = price;
    let stopLoss = Number((price - atr * 1.2).toFixed(digits));
    let takeProfit1 = Number((price + atr * 1.5).toFixed(digits));
    let takeProfit2 = Number((price + atr * 2.8).toFixed(digits));
    let takeProfit3 = Number((price + atr * 4.2).toFixed(digits));
    let strategyType: TradeSetup['strategyType'] = 'TREND_FOLLOWING';

    if (recommendation === 'STRONG_BUY' || recommendation === 'BUY') {
      entryPrice = price;
      stopLoss = Number((price - atr * 1.15).toFixed(digits));
      takeProfit1 = Number((price + atr * 1.5).toFixed(digits));
      takeProfit2 = Number((price + atr * 2.8).toFixed(digits));
      takeProfit3 = Number((price + atr * 4.2).toFixed(digits));
      strategyType = 'TREND_FOLLOWING';
    } else if (recommendation === 'SELL' || recommendation === 'STRONG_SELL') {
      entryPrice = price;
      stopLoss = Number((price + atr * 1.15).toFixed(digits));
      takeProfit1 = Number((price - atr * 1.5).toFixed(digits));
      takeProfit2 = Number((price - atr * 2.8).toFixed(digits));
      takeProfit3 = Number((price - atr * 4.2).toFixed(digits));
      strategyType = 'COUNTER_TREND';
    } else {
      // WAIT setup
      entryPrice = price;
      stopLoss = Number((price - atr).toFixed(digits));
      takeProfit1 = Number((price + atr).toFixed(digits));
      takeProfit2 = Number((price + atr * 1.5).toFixed(digits));
      takeProfit3 = Number((price + atr * 2.0).toFixed(digits));
      strategyType = 'RANGE_BOUND';
    }

    const riskDistance = Math.abs(entryPrice - stopLoss);
    const rewardDistance = Math.abs(takeProfit1 - entryPrice);
    const riskRewardRatio = Number((rewardDistance / (riskDistance || 1)).toFixed(2));
    const suggestedLotSize = Number(((10000 * 0.01) / (riskDistance * resolved.spec.contractSize || 1)).toFixed(2));

    const setup: TradeSetup = {
      signal: recommendation,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      riskRewardRatio,
      riskAmountPercent: 1.0, // Strict 1% risk management
      suggestedLotSize: Math.max(0.01, Math.min(0.01, suggestedLotSize || 0.01)),
      reasoning: [
        `Multi-Engine Confluence Score for ${canonical} is ${Math.round(compositeScore)}/100 (Fundamental: ${fundamental.score}, Technical: ${technical.score}, Sentiment: ${sentiment.score}, AI Confidence: ${aiConfidence.score}%).`,
        `Risk-to-Reward ratio is 1:${riskRewardRatio} targeting Take Profit 1 ($${takeProfit1}) with Stop Loss placed at $${stopLoss}.`,
        `Recommended risk per trade is strictly capped at 1.0% account equity with max test lot 0.01.`,
      ],
      strategyType,
    };

    // Update Single Source of Truth Active Signal in DB
    const activeDirection = recommendation === 'STRONG_BUY' || recommendation === 'BUY' ? 'BUY' : recommendation === 'STRONG_SELL' || recommendation === 'SELL' ? 'SELL' : 'WAIT';
    
    // Maintain existing signal ID if unchanged direction & entry, or generate new
    const currentActive = db.getActiveSignal(canonical);
    const isSameDirection = currentActive && currentActive.direction === activeDirection && Math.abs(currentActive.entryPrice - entryPrice) < (isForex ? 0.001 : 2.0);
    const signalId = isSameDirection ? currentActive.signalId : `SIG-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 12)}`;

    console.log(`[FORENSIC AI SIGNAL CREATED] signalId=${signalId} symbol=${canonical} direction=${activeDirection} entryPrice=${entryPrice} tp1=${takeProfit1} tp2=${takeProfit2} sl=${stopLoss} confidence=${aiConfidence.score} createdAt=${new Date().toISOString()}`);

    db.setActiveSignal({
      signalId,
      symbol: canonical,
      direction: activeDirection,
      confidence: aiConfidence.score,
      entryPrice,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      stopLoss,
      riskReward: `1 : ${riskRewardRatio}`,
      reasoning: setup.reasoning.join(' '),
      status: currentActive?.status || 'ACTIVE',
      executionStatus: currentActive?.executionStatus || 'NONE',
      mt5Ticket: currentActive?.mt5Ticket,
    });

    return {
      symbol: canonical,
      currentPrice: price,
      timestamp: new Date().toISOString(),
      recommendation,
      setup,
      fundamentalScore: fundamental,
      technicalScore: technical,
      sentimentScore: sentiment,
      riskScore: risk,
      aiConfidence,
      validation,
    };
  }
}

export const recommendationEngine = new RecommendationEngine();
