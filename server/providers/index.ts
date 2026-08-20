import { IDataProvider } from './types.js';
import { mt5Provider } from './Mt5Provider.js';
import { forexFactoryProvider } from './ForexFactoryProvider.js';
import { fredProvider } from './FredProvider.js';
import { cotProvider } from './CotProvider.js';
import { worldGoldCouncilProvider } from './WorldGoldCouncilProvider.js';
import { cmeFedWatchProvider } from './CmeFedWatchProvider.js';
import { iceDollarIndexProvider } from './IceDollarIndexProvider.js';
import { reutersProvider } from './ReutersProvider.js';
import { kitcoProvider } from './KitcoProvider.js';
import { investingProvider } from './InvestingProvider.js';
import { tradingEconomicsProvider } from './TradingEconomicsProvider.js';
import { blsProvider } from './BlsProvider.js';
import { beaProvider } from './BeaProvider.js';
import { bloombergProvider } from './BloombergProvider.js';

export * from './types.js';
export * from './BaseProvider.js';

class ProviderRegistry {
  private providers: Map<string, IDataProvider> = new Map();

  constructor() {
    this.register(mt5Provider);
    this.register(forexFactoryProvider);
    this.register(fredProvider);
    this.register(cotProvider);
    this.register(worldGoldCouncilProvider);
    this.register(cmeFedWatchProvider);
    this.register(iceDollarIndexProvider);
    this.register(reutersProvider);
    this.register(kitcoProvider);
    this.register(investingProvider);
    this.register(tradingEconomicsProvider);
    this.register(blsProvider);
    this.register(beaProvider);
    this.register(bloombergProvider);
  }

  public register(provider: IDataProvider): void {
    this.providers.set(provider.metadata.id, provider);
  }

  public getProvider(id: string): IDataProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): IDataProvider[] {
    return Array.from(this.providers.values());
  }

  public getProviderMetadataList() {
    return this.getAllProviders().map((p) => p.metadata);
  }

  public getProviderStatuses() {
    return this.getAllProviders().map((p) => {
      const health = p.getHealth();
      return {
        id: p.metadata.id,
        name: p.metadata.name,
        type: p.metadata.type,
        description: p.metadata.description,
        dataType: p.metadata.dataType,
        requiresApiKey: p.metadata.requiresApiKey,
        hasOfficialApi: p.metadata.hasOfficialApi,
        refreshInterval: p.metadata.refreshInterval,
        status: health.status,
        message: health.message,
        lastUpdate: health.lastSync,
        responseTimeMs: health.responseTimeMs,
      };
    });
  }
}

export const providerRegistry = new ProviderRegistry();
