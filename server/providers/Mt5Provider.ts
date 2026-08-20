import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { mt5Collector } from '../collectors/mt5Collector.js';

export class Mt5Provider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'mt5',
    name: 'MetaTrader 5 (MT5)',
    type: 'OFFICIAL_API',
    description: 'MetaTrader 5 Realtime Terminal Bridge & OHLC Candle Stream',
    dataType: 'XAUUSD Live Ticks & Multi-Timeframe Candles',
    requiresApiKey: false,
    hasOfficialApi: true,
    refreshInterval: 'Realtime',
  };

  public fetchData() {
    return {
      connectedBroker: 'SPILLA_QUANT_PRIME_MT5',
      accountType: 'INSTITUTIONAL_STP',
      pingMs: 2,
      liveMarket: mt5Collector.fetchLiveMarket(),
      candles: {
        M15: mt5Collector.getCandles('M15'),
        H1: mt5Collector.getCandles('H1'),
        H4: mt5Collector.getCandles('H4'),
        D1: mt5Collector.getCandles('D1'),
      },
    };
  }
}

export const mt5Provider = new Mt5Provider();
