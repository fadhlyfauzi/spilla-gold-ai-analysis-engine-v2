import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { cmeFedWatchCollector } from '../collectors/cmeFedWatchCollector.js';

export class CmeFedWatchProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'cmefedwatch',
    name: 'CME FedWatch',
    type: 'PLACEHOLDER',
    description: '30-Day Fed Funds Futures Interest Rate Probabilities',
    dataType: 'FOMC Rate Expectations',
    requiresApiKey: false,
    hasOfficialApi: false,
    refreshInterval: '5 Min',
  };

  public fetchData() {
    return cmeFedWatchCollector.fetchRateProbabilities();
  }
}

export const cmeFedWatchProvider = new CmeFedWatchProvider();
