import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { investingCollector } from '../collectors/investingCollector.js';

export class InvestingProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'investing',
    name: 'Investing.com',
    type: 'WEB_SCRAPER',
    description: 'Retail Trader Positioning Ratio & Market Sentiment Metrics',
    dataType: 'Retail Bull/Bear Ratios',
    requiresApiKey: false,
    hasOfficialApi: false,
    refreshInterval: '5 Min',
  };

  public fetchData() {
    return investingCollector.fetchMarketSentimentMetrics();
  }
}

export const investingProvider = new InvestingProvider();
