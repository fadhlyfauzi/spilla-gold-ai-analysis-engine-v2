import { Router } from 'express';
import { snapshotService } from '../services/snapshotService.js';
import { marketDataService } from '../services/marketDataService.js';

export const snapshotRouter = Router();

// Save new auto-snapshot image from Market Overview
snapshotRouter.post('/save', (req, res) => {
  try {
    const { imageDataUrl, symbol, timeframe, currentPrice } = req.body;
    if (!imageDataUrl) {
      return res.status(400).json({ success: false, message: 'imageDataUrl is required' });
    }

    const reqSym = (symbol as string) || 'XAUUSD';
    const snapshot = snapshotService.saveSnapshot({
      imageDataUrl,
      symbol: reqSym,
      timeframe,
      currentPrice: Number(currentPrice) || marketDataService.getCurrentPrice(reqSym),
    });

    return res.json({
      success: true,
      snapshot: {
        id: snapshot.id,
        timestamp: snapshot.timestamp,
        timeFormatted: snapshot.timeFormatted,
        symbol: snapshot.symbol,
        timeframe: snapshot.timeframe,
        currentPrice: snapshot.currentPrice,
        hasImage: true,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Failed to save snapshot' });
  }
});

// Get latest snapshot info & image
snapshotRouter.get('/latest', (req, res) => {
  try {
    const reqSym = (req.query.symbol as string) || 'XAUUSD';
    const snapshot = snapshotService.getLatestSnapshot(reqSym);
    const history = snapshotService.getSignalHistory(reqSym);
    if (!snapshot) {
      return res.json({ success: true, snapshot: null, history });
    }

    return res.json({
      success: true,
      snapshot,
      history,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Error fetching snapshot' });
  }
});

// Get signal history logs
snapshotRouter.get('/history', (req, res) => {
  try {
    const reqSym = (req.query.symbol as string) || 'XAUUSD';
    const history = snapshotService.getSignalHistory(reqSym);
    return res.json({ success: true, history });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Error fetching history' });
  }
});

// Run Gemini Multimodal Visual Pattern Analysis on the snapshot
snapshotRouter.post('/analyze', async (req, res) => {
  try {
    const { snapshotId, currentPrice, symbol } = req.body;
    const reqSym = (symbol as string) || 'XAUUSD';
    const latestSnap = snapshotService.getLatestSnapshot(reqSym);

    const result = await snapshotService.analyzeSnapshotWithGemini(
      latestSnap,
      Number(currentPrice) || latestSnap?.currentPrice || marketDataService.getCurrentPrice(reqSym)
    );

    const history = snapshotService.getSignalHistory(reqSym);

    return res.json({
      success: true,
      analysis: result,
      history,
      snapshotInfo: latestSnap
        ? {
            id: latestSnap.id,
            timestamp: latestSnap.timestamp,
            timeFormatted: latestSnap.timeFormatted,
          }
        : null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Failed to analyze snapshot' });
  }
});

