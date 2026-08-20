import { Router } from 'express';
import { providerRegistry } from '../providers/index.js';
import { db } from '../db/database.js';

export const systemRouter = Router();

systemRouter.get('/', (req, res) => {
  try {
    const memoryUsageMB = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
    const providerStatuses = providerRegistry.getProviderStatuses();
    const recentLogs = db.getLogs().slice(0, 10);

    res.json({
      application: 'SPILLA GOLD Analysis Engine',
      version: 'v3.6.2 Enterprise',
      aiModel: 'AI 3.6 Flash Synced',
      uptimeSeconds: Math.round(process.uptime()),
      status: 'OPERATIONAL',
      memory: {
        heapUsedMB: memoryUsageMB,
        heapTotalMB: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      },
      providers: {
        total: providerStatuses.length,
        online: providerStatuses.filter((p) => p.status === 'ONLINE').length,
        list: providerStatuses,
      },
      recentLogs,
      database: {
        type: process.env.DATABASE_URL ? 'PostgreSQL (Prisma Enabled)' : 'In-Memory Cache (Synced)',
        status: 'HEALTHY',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch system diagnostics' });
  }
});
