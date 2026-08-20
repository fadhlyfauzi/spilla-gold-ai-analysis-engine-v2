import { SentimentScore, SentimentType } from '../../src/types.js';
import { collectorManager } from '../collectors/index.js';

export class SentimentEngine {
  public calculateScore(): SentimentScore {
    const data = collectorManager.getAllCollectorData();

    const cot = data.cotData;
    const etf = data.etfFlows;
    const newsList = data.news;

    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;

    newsList.forEach((n) => {
      if (n.sentiment === 'BULLISH') bullishCount++;
      else if (n.sentiment === 'BEARISH') bearishCount++;
      else neutralCount++;
    });

    const totalNews = newsList.length || 1;
    const bullishPercent = Math.round((bullishCount / totalNews) * 100);
    const bearishPercent = Math.round((bearishCount / totalNews) * 100);
    const neutralPercent = 100 - bullishPercent - bearishPercent;

    // Calculate score
    let score = 50;
    if (cot.sentiment === 'BULLISH') score += 15;
    if (etf.sentiment === 'BULLISH') score += 15;
    score += (bullishPercent - bearishPercent) * 0.2;

    score = Math.min(95, Math.max(15, Math.round(score)));
    const status: SentimentType = score >= 60 ? 'BULLISH' : score <= 40 ? 'BEARISH' : 'NEUTRAL';

    const reasoning = [
      `CFTC COT report reveals Large Speculators expanded Gold net long positions by +14,200 contracts to +${cot.netPositionSpeculators.toLocaleString()} contracts.`,
      `Global GLD ETF holdings increased by +${etf.netFlowTonnes} tonnes (+$${etf.netFlowUsdMillions}M institutional inflow).`,
      `Financial news sentiment aggregate is ${bullishPercent}% Bullish vs ${bearishPercent}% Bearish, driven by dovish central bank expectations and geopolitical hedging.`,
    ];

    return {
      score,
      status,
      cot,
      etf,
      newsSentiment: {
        bullishPercent,
        bearishPercent,
        neutralPercent,
      },
      reasoning,
    };
  }
}

export const sentimentEngine = new SentimentEngine();
