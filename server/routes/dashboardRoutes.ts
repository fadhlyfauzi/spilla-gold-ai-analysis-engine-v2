import { Router } from 'express';
import { recommendationEngine } from '../engines/recommendationEngine.js';
import { collectorManager } from '../collectors/index.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  try {
    const rec = await recommendationEngine.generateRecommendation();
    const collectorsData = collectorManager.getAllCollectorData();

    res.json({
      timestamp: new Date().toISOString(),
      liveMarket: collectorsData.liveMarket,
      recommendation: {
        signal: rec.recommendation,
        setup: rec.setup,
        aiConfidence: rec.aiConfidence,
        rationale: rec.setup.reasoning,
      },
      scores: {
        fundamental: rec.fundamentalScore,
        technical: rec.technicalScore,
        sentiment: rec.sentimentScore,
        risk: rec.riskScore,
      },
      news: collectorsData.news.slice(0, 5),
      calendar: collectorsData.calendarEvents.slice(0, 5),
      systemStatus: {
        engine: 'SPILLA GOLD CORE v3.6.2',
        status: 'OPERATIONAL',
        activeCollectors: 14,
        dbStatus: 'CONNECTED',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to assemble dashboard analysis payload' });
  }
});
