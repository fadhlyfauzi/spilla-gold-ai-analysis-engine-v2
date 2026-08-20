import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { iceDollarIndexCollector } from '../collectors/iceDollarIndexCollector.js';

export class IceDollarIndexProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'dxy',
    name: 'ICE Dollar Index (DXY)',
    type: 'WEB_SCRAPER',
    description: 'US Dollar Currency Index & FX Basket Rates',
    dataType: 'Dollar Index & FX Correlations',
    requiresApiKey: false,
    hasOfficialApi: false,
    refreshInterval: 'Realtime',
  };

  public fetchData() {
    return iceDollarIndexCollector.fetchDxyDetails();
  }
}

export const iceDollarIndexProvider = new IceDollarIndexProvider();
