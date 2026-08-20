import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { kitcoCollector } from '../collectors/kitcoCollector.js';

export class KitcoProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'kitco',
    name: 'Kitco',
    type: 'RSS_FEED',
    description: 'Precious Metals Market Commentary & Vault Industry News',
    dataType: 'Precious Metals News',
    requiresApiKey: false,
    hasOfficialApi: false,
    refreshInterval: '15 Min',
  };

  public fetchData() {
    return kitcoCollector.fetchGoldMetalsNews();
  }
}

export const kitcoProvider = new KitcoProvider();
