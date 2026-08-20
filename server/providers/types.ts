export type ProviderType = 'OFFICIAL_API' | 'RSS_FEED' | 'WEB_SCRAPER' | 'PLACEHOLDER';

export interface ProviderMetadata {
  id: string;
  name: string;
  type: ProviderType;
  description: string;
  dataType: string;
  requiresApiKey: boolean;
  hasOfficialApi: boolean;
  refreshInterval: string;
  sourceUrl?: string;
}

export interface ProviderHealth {
  status: 'ONLINE' | 'WARNING' | 'OFFLINE' | 'UNCONFIGURED';
  message: string;
  lastSync: string;
  responseTimeMs: number;
}

export interface IDataProvider<T = any> {
  readonly metadata: ProviderMetadata;
  isConfigured(): boolean;
  fetchData(): Promise<T> | T;
  getHealth(): ProviderHealth;
}
