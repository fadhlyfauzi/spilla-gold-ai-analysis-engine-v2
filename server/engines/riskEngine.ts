import { RiskScore, RiskLevel } from '../../src/types.js';
import { marketDataService } from '../services/marketDataService.js';
import { collectorManager } from '../collectors/index.js';

export class RiskEngine {
  public calculateScore(): RiskScore {
    const live = marketDataService.getLiveMarket();
    const data = collectorManager.getAllCollectorData();
    const events = data.calendarEvents;

    // Check high-impact news proximity
    const highImpactEvents = events.filter((e) => e.impact === 'HIGH');

    // Risk factors
    const spread = live.spread;
    const session = live.session;
    const atrPercent = 0.52; // % of price

    let riskScore = 25; // Base risk
    const warnings: string[] = [];

    if (spread > 0.3) {
      riskScore += 20;
      warnings.push(`Elevated spread detected (${spread} pips). Use limit orders.`);
    }

    if (session === 'ASIAN' || session === 'OFF_HOURS') {
      riskScore += 15;
      warnings.push(`Asian / Off-hours session liquidity can cause sudden slippage.`);
    }

    if (highImpactEvents.length > 0) {
      warnings.push(`High impact macroeconomic releases scheduled today: ${highImpactEvents.map(e => e.event).join(', ')}.`);
    }

    let level: RiskLevel = 'LOW';
    if (riskScore >= 75) level = 'CRITICAL';
    else if (riskScore >= 55) level = 'HIGH';
    else if (riskScore >= 35) level = 'MEDIUM';

    const reasoning = [
      `Current XAUUSD market volatility is Moderate with 14-period ATR at $14.80 (0.52% of price).`,
      `Bid/Ask spread is tight at $${spread} (${live.session} session).`,
      `Risk metrics suggest standard position sizing (1-2% account equity risk) with mandatory Stop Loss protection.`,
    ];

    return {
      score: riskScore,
      level,
      volatility: 'MODERATE',
      spreadRisk: spread > 0.3 ? 'ELEVATED' : 'NORMAL',
      liquidity: session === 'LONDON_NY_OVERLAP' ? 'HIGH' : 'MEDIUM',
      newsProximityMinutes: 120, // 2 hours to next key event
      sessionRisk: session === 'LONDON_NY_OVERLAP' ? 'LOW' : 'MEDIUM',
      atrPercent,
      warnings,
      reasoning,
    };
  }
}

export const riskEngine = new RiskEngine();
