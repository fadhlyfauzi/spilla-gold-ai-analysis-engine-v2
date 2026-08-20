import { Router } from 'express';
import { collectorManager } from '../collectors/index.js';

export const calendarRouter = Router();

calendarRouter.get('/', (req, res) => {
  try {
    const data = collectorManager.getAllCollectorData();
    res.json({
      timestamp: new Date().toISOString(),
      total: data.calendarEvents.length,
      events: data.calendarEvents,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve economic calendar' });
  }
});
