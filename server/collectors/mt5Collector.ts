import { MarketPrice, Candle } from '../../src/types.js';
import { marketDataService } from '../services/marketDataService.js';

/**
 * MetaTrader 5 (MT5) Collector Bridge
 * Consumes real-time data from marketDataService (Single Source of Truth).
 * Zero random price generation or un-synced state.
 */
class Mt5Collector {
  public fetchLiveMarket(): MarketPrice {
    return marketDataService.getLiveMarket();
  }

  public getCandles(timeframe: string = 'H1'): Candle[] {
    return marketDataService.getCandles(timeframe);
  }

  public updatePrice(newPrice: number): void {
    marketDataService.updatePriceFromProvider(newPrice, 'MetaTrader 5 (MT5) Bridge');
  }
}

export const mt5Collector = new Mt5Collector();
