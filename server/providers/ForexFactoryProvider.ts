import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { forexFactoryCollector } from '../collectors/forexFactoryCollector.js';

export class ForexFactoryProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'forexfactory',
    name: 'ForexFactory',
    type: 'RSS_FEED',
    description: 'High-Impact Economic Calendar & Macro Releases',
    dataType: 'Economic Calendar Events',
    requiresApiKey: false,
    hasOfficialApi: false,
    refreshInterval: '1 Min',
  };

  public fetchData() {
    return forexFactoryCollector.fetchEconomicCalendar();
  }
}

export const forexFactoryProvider = new ForexFactoryProvider();
