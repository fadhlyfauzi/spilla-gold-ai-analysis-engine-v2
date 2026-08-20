import { Router } from 'express';
import { collectorManager } from '../collectors/index.js';

export const newsRouter = Router();

newsRouter.get('/', (req, res) => {
  try {
    const data = collectorManager.getAllCollectorData();
    res.json({
      timestamp: new Date().toISOString(),
      total: data.news.length,
      news: data.news,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve news stream' });
  }
});
