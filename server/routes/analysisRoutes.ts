import { Router } from 'express';
import { technicalEngine } from '../engines/technicalEngine.js';
import { sentimentEngine } from '../engines/sentimentEngine.js';
import { riskEngine } from '../engines/riskEngine.js';
import { recommendationEngine } from '../engines/recommendationEngine.js';
import { collectorManager } from '../collectors/index.js';
import { providerRegistry } from '../providers/index.js';
import { db } from '../db/database.js';
import { spillaAssistantService } from '../services/spillaAssistantService.js';

export const technicalRouter = Router();
technicalRouter.get('/', (req, res) => {
  res.json(technicalEngine.calculateScore());
});

export const sentimentRouter = Router();
sentimentRouter.get('/', (req, res) => {
  res.json(sentimentEngine.calculateScore());
});

export const riskRouter = Router();
riskRouter.get('/', (req, res) => {
  res.json(riskEngine.calculateScore());
});

export const recommendationRouter = Router();
recommendationRouter.get('/', async (req, res) => {
  try {
    const rec = await recommendationEngine.generateRecommendation();
    
    // Save snapshot to history DB if requested
    if (req.query.save === 'true') {
      db.addHistoryRecord({
        timestamp: new Date().toISOString(),
        price: rec.currentPrice,
        recommendation: rec.recommendation,
        fundamentalScore: rec.fundamentalScore.score,
        technicalScore: rec.technicalScore.score,
        sentimentScore: rec.sentimentScore.score,
        riskScore: rec.riskScore.score,
        aiConfidence: rec.aiConfidence.score,
        entryPrice: rec.setup.entryPrice,
        stopLoss: rec.setup.stopLoss,
        takeProfit1: rec.setup.takeProfit1,
        riskRewardRatio: rec.setup.riskRewardRatio,
        status: 'PENDING',
      });
    }

    res.json(rec);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate recommendation' });
  }
});

export const aiRouter = Router();
aiRouter.get('/', async (req, res) => {
  try {
    const rec = await recommendationEngine.generateRecommendation();
    res.json(rec.aiConfidence);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/current-signal - Single Source of Truth Active AI Signal
aiRouter.get('/current-signal', async (req, res) => {
  try {
    let activeSignal = db.getActiveSignal();
    if (!activeSignal) {
      await recommendationEngine.generateRecommendation();
      activeSignal = db.getActiveSignal();
    }
    console.log(`[FORENSIC API CURRENT SIGNAL] signalId=${activeSignal?.signalId || 'NONE'} entryPrice=${activeSignal?.entryPrice || 0} status=${activeSignal?.status || 'N/A'}`);
    res.json({
      success: true,
      activeSignal,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve active AI signal' });
  }
});

// GET /api/ai/signal-history - Signal History directly from database
aiRouter.get('/signal-history', (req, res) => {
  try {
    const history = db.getHistory();
    res.json({
      success: true,
      history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve signal history' });
  }
});

aiRouter.post('/assistant', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Field message is required' });
    }
    const result = await spillaAssistantService.chat(message, history || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process AI assistant request' });
  }
});

export const historyRouter = Router();
historyRouter.get('/', (req, res) => {
  res.json(db.getHistory());
});

export const collectorsRouter = Router();
collectorsRouter.get('/', (req, res) => {
  res.json(providerRegistry.getProviderStatuses());
});

collectorsRouter.post('/sync', (req, res) => {
  const data = collectorManager.getAllCollectorData();
  db.addLog('INFO', 'COLLECTORS', 'Manual synchronization triggered across all 14 data collectors.');
  res.json({ message: 'Synchronized successfully', timestamp: new Date().toISOString() });
});

export const settingsRouter = Router();
settingsRouter.get('/', (req, res) => {
  res.json(db.getSettings());
});

settingsRouter.post('/', (req, res) => {
  const updated = db.updateSettings(req.body);
  res.json(updated);
});

export const logsRouter = Router();
logsRouter.get('/', (req, res) => {
  res.json(db.getLogs());
});
