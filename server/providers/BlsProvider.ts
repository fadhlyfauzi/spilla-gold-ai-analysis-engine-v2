import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { macroCollectors } from '../collectors/tradingEconomicsCollector.js';

export class BlsProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'bls',
    name: 'BLS (Labor Statistics)',
    type: 'OFFICIAL_API',
    description: 'US Non-Farm Payrolls, CPI Inflation & Unemployment Rate',
    dataType: 'US Employment & Inflation Statistics',
    requiresApiKey: false,
    hasOfficialApi: true,
    refreshInterval: 'Monthly',
  };

  public fetchData() {
    return macroCollectors.fetchBlsData();
  }
}

export const blsProvider = new BlsProvider();
