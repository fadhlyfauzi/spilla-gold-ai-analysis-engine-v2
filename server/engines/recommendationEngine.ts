import {
  RecommendationResponse,
  SignalType,
  TradeSetup,
} from '../../src/types.js';
import { marketDataService } from '../services/marketDataService.js';
import { fundamentalEngine } from './fundamentalEngine.js';
import { technicalEngine } from './technicalEngine.js';
import { sentimentEngine } from './sentimentEngine.js';
import { riskEngine } from './riskEngine.js';
import { aiConfidenceEngine } from './aiConfidenceEngine.js';
import { db } from '../db/database.js';

export class RecommendationEngine {
  public async generateRecommendation(): Promise<RecommendationResponse> {
    const price = marketDataService.getCurrentPrice();
    const validation = marketDataService.validateSync();

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
    const atr = technical.atr14 || 14.8;
    const pivot = technical.pivotPoints;

    let entryPrice = price;
    let stopLoss = Number((price - atr * 1.2).toFixed(2));
    let takeProfit1 = Number((price + atr * 1.5).toFixed(2));
    let takeProfit2 = Number((price + atr * 2.8).toFixed(2));
    let takeProfit3 = Number((price + atr * 4.2).toFixed(2));
    let strategyType: TradeSetup['strategyType'] = 'TREND_FOLLOWING';

    if (recommendation === 'STRONG_BUY' || recommendation === 'BUY') {
      entryPrice = price;
      stopLoss = Number((price - atr * 1.15).toFixed(2)); // ~$17 stop
      takeProfit1 = Number(pivot.r1 > price ? pivot.r1 : price + atr * 1.5);
      takeProfit2 = Number(pivot.r2 > takeProfit1 ? pivot.r2 : price + atr * 2.8);
      takeProfit3 = Number(pivot.r3 > takeProfit2 ? pivot.r3 : price + atr * 4.2);
      strategyType = 'TREND_FOLLOWING';
    } else if (recommendation === 'SELL' || recommendation === 'STRONG_SELL') {
      entryPrice = price;
      stopLoss = Number((price + atr * 1.15).toFixed(2));
      takeProfit1 = Number(pivot.s1 < price ? pivot.s1 : price - atr * 1.5);
      takeProfit2 = Number(pivot.s2 < takeProfit1 ? pivot.s2 : price - atr * 2.8);
      takeProfit3 = Number(pivot.s3 < takeProfit2 ? pivot.s3 : price - atr * 4.2);
      strategyType = 'COUNTER_TREND';
    } else {
      // WAIT setup
      entryPrice = price;
      stopLoss = Number((pivot.s1).toFixed(2));
      takeProfit1 = Number((pivot.r1).toFixed(2));
      takeProfit2 = Number((pivot.r2).toFixed(2));
      takeProfit3 = Number((pivot.r3).toFixed(2));
      strategyType = 'RANGE_BOUND';
    }

    const riskDistance = Math.abs(entryPrice - stopLoss);
    const rewardDistance = Math.abs(takeProfit1 - entryPrice);
    const riskRewardRatio = Number((rewardDistance / (riskDistance || 1)).toFixed(2));
    const suggestedLotSize = Number(((10000 * 0.01) / (riskDistance * 100 || 1)).toFixed(2));

    const setup: TradeSetup = {
      signal: recommendation,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      riskRewardRatio,
      riskAmountPercent: 1.0, // Strict 1% risk management
      suggestedLotSize,
      reasoning: [
        `Multi-Engine Confluence Score is ${Math.round(compositeScore)}/100 (Fundamental: ${fundamental.score}, Technical: ${technical.score}, Sentiment: ${sentiment.score}, AI Confidence: ${aiConfidence.score}%).`,
        `Risk-to-Reward ratio is 1:${riskRewardRatio} targeting Take Profit 1 ($${takeProfit1}) with Stop Loss placed at $${stopLoss}.`,
        `Recommended risk per trade is strictly capped at 1.0% account equity (${suggestedLotSize || 0.10} lots per $10,000 balance).`,
      ],
      strategyType,
    };

    // Update Single Source of Truth Active Signal in DB
    const activeDirection = recommendation === 'STRONG_BUY' || recommendation === 'BUY' ? 'BUY' : recommendation === 'STRONG_SELL' || recommendation === 'SELL' ? 'SELL' : 'WAIT';
    
    // Maintain existing signal ID if unchanged direction & entry, or generate new
    const currentActive = db.getActiveSignal();
    const isSameDirection = currentActive && currentActive.direction === activeDirection && Math.abs(currentActive.entryPrice - entryPrice) < 2.0;
    const signalId = isSameDirection ? currentActive.signalId : `SIG-${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 12)}`;

    console.log(`[FORENSIC AI SIGNAL CREATED] signalId=${signalId} symbol=XAUUSD direction=${activeDirection} entryPrice=${entryPrice} tp1=${takeProfit1} tp2=${takeProfit2} sl=${stopLoss} confidence=${aiConfidence.score} createdAt=${new Date().toISOString()}`);

    db.setActiveSignal({
      signalId,
      symbol: 'XAUUSD',
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
      symbol: 'XAUUSD',
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
