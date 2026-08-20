import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { marketRouter } from './server/routes/marketRoutes.js';
import { fundamentalRouter } from './server/routes/fundamentalRoutes.js';
import { dashboardRouter } from './server/routes/dashboardRoutes.js';
import { newsRouter } from './server/routes/newsRoutes.js';
import { calendarRouter } from './server/routes/calendarRoutes.js';
import { systemRouter } from './server/routes/systemRoutes.js';
import { healthRouter } from './server/routes/healthRoutes.js';
import { eaRouter } from './server/routes/eaRoutes.js';
import { authRouter } from './server/routes/authRoutes.js';
import { adminRouter } from './server/routes/adminRoutes.js';
import { copytradeRouter } from './server/routes/copytradeRoutes.js';
import {
  technicalRouter,
  sentimentRouter,
  riskRouter,
  recommendationRouter,
  aiRouter,
  historyRouter,
  collectorsRouter,
  settingsRouter,
  logsRouter,
} from './server/routes/analysisRoutes.js';

import { snapshotRouter } from './server/routes/snapshotRoutes.js';
import { copilotRouter } from './server/routes/copilotRoutes.js';
import { tradeRouter } from './server/routes/tradeRoutes.js';
import { creditRouter, adminCreditRouter } from './server/routes/creditRoutes.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint (Railway requirement)
  app.use('/api/health', healthRouter);

  // MT5 Execution Bridge Queue (Phase 1)
  app.use('/api/trade', tradeRouter);

  // SPILLA AI Credit System Endpoints
  app.use('/api/credit', creditRouter);
  app.use('/api/admin/credit', adminCreditRouter);

  // Authentication & Admin Management Endpoints
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/copytrade', copytradeRouter);

  // Copilot Architecture Hardening API
  app.use('/api/copilot', copilotRouter);

  // Core API Endpoints
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/fundamental', fundamentalRouter);
  app.use('/api/technical', technicalRouter);
  app.use('/api/sentiment', sentimentRouter);
  app.use('/api/risk', riskRouter);
  app.use('/api/recommendation', recommendationRouter);
  app.use('/api/ea', eaRouter);
  app.use('/api/mt5-data', eaRouter);
  app.use('/api/snapshot', snapshotRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/news', newsRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/system', systemRouter);

  // Additional Helper Endpoints
  app.use('/api/market', marketRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/collectors', collectorsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/logs', logsRouter);

  // Vite Middleware for Development / Static serving for Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SPILLA GOLD Analysis Engine running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
