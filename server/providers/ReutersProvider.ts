import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { reutersCollector } from '../collectors/reutersCollector.js';

export class ReutersProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'reuters',
    name: 'Reuters',
    type: 'RSS_FEED',
    description: 'Breaking Commodity News & Macro Geopolitical Flashes',
    dataType: 'Financial News Feed',
    requiresApiKey: false,
    hasOfficialApi: false,
    refreshInterval: '2 Min',
  };

  public fetchData() {
    return reutersCollector.fetchBreakingNews();
  }
}

export const reutersProvider = new ReutersProvider();
