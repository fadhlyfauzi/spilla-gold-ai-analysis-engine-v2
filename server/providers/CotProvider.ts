import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { cotCollector } from '../collectors/cotCollector.js';

export class CotProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'cftc',
    name: 'CFTC',
    type: 'WEB_SCRAPER',
    description: 'Commitment of Traders (COT) Speculator Net Positioning',
    dataType: 'Institutional Futures Positioning',
    requiresApiKey: false,
    hasOfficialApi: false,
    refreshInterval: 'Weekly',
  };

  public fetchData() {
    return cotCollector.fetchCotData();
  }
}

export const cotProvider = new CotProvider();
