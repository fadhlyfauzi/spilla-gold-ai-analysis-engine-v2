import { Router } from 'express';
import { marketDataService } from '../services/marketDataService.js';
import { collectorManager } from '../collectors/index.js';

export const marketRouter = Router();

// GET /api/market/current - Live price and ticker from single source of truth
marketRouter.get('/current', async (req, res) => {
  const reqSym = (req.query.symbol as string) || 'XAUUSD';
  marketDataService.logMarketDataDebug('GET_CURRENT');
  await marketDataService.fetchFreshestMarketPrice(reqSym).catch(() => {});
  const liveMarket = marketDataService.getLiveMarket(reqSym);

  const validation = marketDataService.validateSync();
  res.json({
    ...liveMarket,
    validationStatus: validation.status,
    validationMessage: validation.message,
  });
});

// GET /api/market/canonical - Fast canonical market snapshot for Analysis Now
marketRouter.get('/canonical', async (req, res) => {
  const reqSym = (req.query.symbol as string) || 'XAUUSD';
  const price = await marketDataService.fetchFreshestMarketPrice(reqSym).catch(() => null);
  const liveMarket = marketDataService.getLiveMarket(reqSym);
  res.json({
    success: true,
    symbol: liveMarket.symbol || reqSym,
    price: price || liveMarket.price,
    last: price || liveMarket.price,
    bid: liveMarket.bid,
    ask: liveMarket.ask,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/market/live - Alias for backward compatibility
marketRouter.get('/live', (req, res) => {
  const liveMarket = marketDataService.getLiveMarket();
  res.json(liveMarket);
});

// GET /api/market/candles - Candlestick OHLC array for Lightweight Charts
marketRouter.get('/candles', (req, res) => {
  const timeframe = (req.query.timeframe as string) || 'H1';
  const candles = marketDataService.getCandles(timeframe);
  const validation = marketDataService.validateSync();
  res.json({ timeframe, candles, validation });
});

// GET /api/market/chart - Alias for backward compatibility
marketRouter.get('/chart', (req, res) => {
  const timeframe = (req.query.timeframe as string) || 'H1';
  const candles = marketDataService.getCandles(timeframe);
  res.json({ timeframe, candles });
});

// GET /api/market/ohlc - Current active OHLC bar
marketRouter.get('/ohlc', (req, res) => {
  const timeframe = (req.query.timeframe as string) || 'H1';
  const ohlc = marketDataService.getOHLC(timeframe);
  res.json({ timeframe, ohlc });
});

// GET /api/market/overview - Complete aggregated market snapshot
marketRouter.get('/overview', (req, res) => {
  const overview = marketDataService.getOverview();
  const collectorsData = collectorManager.getAllCollectorData();
  res.json({
    ...overview,
    fredData: collectorsData.fredData,
    dxyDetails: collectorsData.dxyDetails,
    fedWatch: collectorsData.fedWatch,
  });
});
