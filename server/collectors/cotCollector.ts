import { CotData } from '../../src/types.js';

export class CotCollector {
  public fetchCotData(): CotData {
    return {
      commercialLongs: 84200,
      commercialShorts: 298400,
      nonCommercialLongs: 312500, // Large Speculators buying
      nonCommercialShorts: 58200,
      netPositionSpeculators: 254300, // Bullish bias
      changeFromLastWeek: +14200,
      sentiment: 'BULLISH',
    };
  }
}

export const cotCollector = new CotCollector();
