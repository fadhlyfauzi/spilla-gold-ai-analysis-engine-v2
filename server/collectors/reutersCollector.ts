import { MarketNews } from '../../src/types.js';

export class ReutersCollector {
  public fetchBreakingNews(): MarketNews[] {
    const now = new Date();
    return [
      {
        id: 'RTR-201',
        source: 'Reuters Wire',
        title: 'Fed Officials Signal Policy Easing as Inflation Cools Toward 2% Target',
        summary: 'Multiple Federal Reserve policymakers indicated readiness to cut interest rates next month if economic data continues to demonstrate steady disinflation.',
        timestamp: new Date(now.getTime() - 1200000).toISOString(),
        impact: 'HIGH',
        sentiment: 'BULLISH',
        category: 'CENTRAL_BANK',
      },
      {
        id: 'RTR-202',
        source: 'Reuters Global',
        title: 'Middle East Geopolitical Friction Drives Safe-Haven Gold Demand Near All-Time Highs',
        summary: 'Escalating maritime regional tensions and supply chain concerns have heightened global investor appetite for physical gold bullion and sovereign hedges.',
        timestamp: new Date(now.getTime() - 3600000 * 2).toISOString(),
        impact: 'HIGH',
        sentiment: 'BULLISH',
        category: 'GEOPOLITICAL',
      },
      {
        id: 'RTR-203',
        source: 'Reuters Markets',
        title: 'US Dollar Index Slides Below Key Moving Average Ahead of Core PCE Release',
        summary: 'The greenback faced renewed selling pressure as global yield differentials narrowed, boosting spot gold prices above $2,860/oz.',
        timestamp: new Date(now.getTime() - 3600000 * 4).toISOString(),
        impact: 'MEDIUM',
        sentiment: 'BULLISH',
        category: 'MARKETS',
      },
    ];
  }
}

export const reutersCollector = new ReutersCollector();
