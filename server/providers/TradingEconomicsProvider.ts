import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { macroCollectors } from '../collectors/tradingEconomicsCollector.js';

export class TradingEconomicsProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'tradingeconomics',
    name: 'Trading Economics',
    type: 'OFFICIAL_API',
    description: 'Global PMI Manufacturing, Services & Growth Indicators',
    dataType: 'Global Macroeconomic Indicators',
    requiresApiKey: false,
    hasOfficialApi: true,
    refreshInterval: 'Hourly',
  };

  constructor() {
    super('TRADING_ECONOMICS_KEY');
  }

  public fetchData() {
    return macroCollectors.fetchTradingEconomicsData();
  }
}

export const tradingEconomicsProvider = new TradingEconomicsProvider();
