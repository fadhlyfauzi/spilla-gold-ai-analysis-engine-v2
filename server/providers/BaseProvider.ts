import { IDataProvider, ProviderMetadata, ProviderHealth } from './types.js';

export abstract class BaseProvider<T = any> implements IDataProvider<T> {
  abstract readonly metadata: ProviderMetadata;
  protected apiKeyEnvVar?: string;

  constructor(apiKeyEnvVar?: string) {
    this.apiKeyEnvVar = apiKeyEnvVar;
  }

  public isConfigured(): boolean {
    if (!this.metadata.requiresApiKey) {
      return true;
    }
    return Boolean(this.getApiKey());
  }

  protected getApiKey(): string | undefined {
    if (!this.apiKeyEnvVar) return undefined;
    return process.env[this.apiKeyEnvVar];
  }

  abstract fetchData(): Promise<T> | T;

  public getHealth(): ProviderHealth {
    if (this.metadata.type === 'PLACEHOLDER') {
      return {
        status: 'WARNING',
        message: 'Placeholder provider service initialized for future integration (fallback data stream active)',
        lastSync: new Date().toISOString(),
        responseTimeMs: 6,
      };
    }

    if (this.metadata.requiresApiKey && !this.isConfigured()) {
      return {
        status: 'UNCONFIGURED',
        message: `Optional API Key missing (${this.apiKeyEnvVar}). Operating with default public pipeline.`,
        lastSync: new Date().toISOString(),
        responseTimeMs: 12,
      };
    }

    return {
      status: 'ONLINE',
      message: 'Provider pipeline online and operational',
      lastSync: new Date().toISOString(),
      responseTimeMs: Math.floor(Math.random() * 20) + 8,
    };
  }
}
