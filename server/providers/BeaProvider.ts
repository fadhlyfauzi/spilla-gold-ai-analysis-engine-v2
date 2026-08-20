import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { macroCollectors } from '../collectors/tradingEconomicsCollector.js';

export class BeaProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'bea',
    name: 'BEA (Economic Analysis)',
    type: 'OFFICIAL_API',
    description: 'US Annualized GDP & Core PCE Inflation Index',
    dataType: 'US GDP & PCE Index Data',
    requiresApiKey: false,
    hasOfficialApi: true,
    refreshInterval: 'Monthly',
  };

  public fetchData() {
    return macroCollectors.fetchBeaData();
  }
}

export const beaProvider = new BeaProvider();
