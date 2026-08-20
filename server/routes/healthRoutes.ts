import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SPILLA GOLD Analysis Engine',
    version: 'v3.6.2',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
  });
});
