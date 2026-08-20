import { BaseProvider } from './BaseProvider.js';
import { ProviderMetadata } from './types.js';
import { fredCollector } from '../collectors/fredCollector.js';

export class FredProvider extends BaseProvider {
  readonly metadata: ProviderMetadata = {
    id: 'fred',
    name: 'FRED (St. Louis Fed)',
    type: 'OFFICIAL_API',
    description: 'TIPS 10-Year Real Yields & M2 Money Supply',
    dataType: 'Yield Curve & Macro Aggregates',
    requiresApiKey: false,
    hasOfficialApi: true,
    refreshInterval: 'Daily',
  };

  constructor() {
    super('FRED_API_KEY');
  }

  public fetchData() {
    return fredCollector.fetchYieldsAndMacro();
  }
}

export const fredProvider = new FredProvider();
