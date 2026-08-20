import { providerRegistry } from '../providers/index.js';
import { db } from '../db/database.js';

class CollectorManager {
  public getAllCollectorData() {
    const start = Date.now();

    const mt5Data = providerRegistry.getProvider('mt5')?.fetchData();
    const calendarEvents = providerRegistry.getProvider('forexfactory')?.fetchData() || [];
    const fredData = providerRegistry.getProvider('fred')?.fetchData();
    const cotData = providerRegistry.getProvider('cftc')?.fetchData();
    const wgcData = providerRegistry.getProvider('wgc')?.fetchData() || {};
    const fedWatch = providerRegistry.getProvider('cmefedwatch')?.fetchData();
    const dxyDetails = providerRegistry.getProvider('dxy')?.fetchData();
    const reutersNews = providerRegistry.getProvider('reuters')?.fetchData() || [];
    const kitcoNews = providerRegistry.getProvider('kitco')?.fetchData() || [];
    const investingSentiment = providerRegistry.getProvider('investing')?.fetchData();
    const macroData = providerRegistry.getProvider('tradingeconomics')?.fetchData();
    const blsData = providerRegistry.getProvider('bls')?.fetchData();
    const beaData = providerRegistry.getProvider('bea')?.fetchData();

    const duration = Date.now() - start;

    // Sync health statuses into DB
    const statuses = providerRegistry.getProviderStatuses();
    statuses.forEach((s) => {
      db.updateCollectorStatus(s.id, {
        latencyMs: s.responseTimeMs,
        status: s.status === 'ONLINE' ? 'HEALTHY' : (s.status as any),
      });
    });

    return {
      liveMarket: mt5Data?.liveMarket,
      calendarEvents,
      fredData,
      cotData,
      etfFlows: wgcData.etfFlows,
      centralBanks: wgcData.centralBanks,
      fedWatch,
      dxyDetails,
      news: [...reutersNews, ...kitcoNews],
      investingSentiment,
      macroData,
      blsData,
      beaData,
      candles: mt5Data?.candles || {},
    };
  }
}

export const collectorManager = new CollectorManager();
