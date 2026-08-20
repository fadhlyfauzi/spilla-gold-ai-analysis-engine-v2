import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { worldGoldCouncilCollector } from '../collectors/worldGoldCouncilCollector.js';

export class WorldGoldCouncilProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'wgc',
    name: 'World Gold Council',
    type: 'PLACEHOLDER',
    description: 'Physical Vault Stocks & Central Bank Gold Reserve Accumulation',
    dataType: 'ETF Flows & Reserve Purchases',
    requiresApiKey: false,
    hasOfficialApi: false,
    refreshInterval: 'Monthly',
  };

  public fetchData() {
    return {
      etfFlows: worldGoldCouncilCollector.fetchEtfFlows(),
      centralBanks: worldGoldCouncilCollector.fetchCentralBankReserveTrends(),
    };
  }
}

export const worldGoldCouncilProvider = new WorldGoldCouncilProvider();
