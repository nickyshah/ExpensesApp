import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import accountsRoutes from './routes/accounts.js';
import transactionsRoutes from './routes/transactions.js';
import categoriesRoutes from './routes/categories.js';
import recurringRoutes from './routes/recurring.js';
import budgetsRoutes from './routes/budgets.js';
import reportsRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import tagsRoutes from './routes/tags.js';
import dataRoutes from './routes/data.js';

export function createApiApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true });
  app.use('/api/auth/login', authLimiter);

  app.use('/api', authMiddleware);

  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/transactions', transactionsRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/recurring', recurringRoutes);
  app.use('/api/budgets', budgetsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/tags', tagsRoutes);
  app.use('/api/data', dataRoutes);

  app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use(errorHandler);

  return app;
}
