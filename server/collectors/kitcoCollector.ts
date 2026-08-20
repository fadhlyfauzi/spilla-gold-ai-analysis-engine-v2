import { MarketNews } from '../../src/types.js';

export class KitcoCollector {
  public fetchGoldMetalsNews(): MarketNews[] {
    const now = new Date();
    return [
      {
        id: 'KIT-301',
        source: 'Kitco Metals',
        title: 'Central Bank Gold Accumulation Reaches Highest Quarterly Volume in 3 Years',
        summary: 'World Gold Council data confirms central banks added over 120 tonnes of net gold reserves in Q2, led by emerging market monetary authorities.',
        timestamp: new Date(now.getTime() - 3600000 * 5).toISOString(),
        impact: 'HIGH',
        sentiment: 'BULLISH',
        category: 'GOLD_DEMAND',
      },
      {
        id: 'KIT-302',
        source: 'Kitco Analysis',
        title: 'Gold Technical Breakout Eyes $2,900 Resistance Level as Real Yields Fall',
        summary: 'Chartered market technicians highlight clean ascending channel formation with strong institutional buying on 4-hour dips.',
        timestamp: new Date(now.getTime() - 3600000 * 8).toISOString(),
        impact: 'MEDIUM',
        sentiment: 'BULLISH',
        category: 'MARKETS',
      },
    ];
  }
}

export const kitcoCollector = new KitcoCollector();
