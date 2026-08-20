import { Router } from 'express';
import { fundamentalEngine } from '../engines/fundamentalEngine.js';

export const fundamentalRouter = Router();

fundamentalRouter.get('/', (req, res) => {
  const result = fundamentalEngine.calculateScore();
  res.json(result);
});
