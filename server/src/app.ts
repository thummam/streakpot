import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { pool } from './db.js';
import { errorHandler, notFound } from './http.js';
import { authRouter } from './routes/auth.js';
import { challengesRouter } from './routes/challenges.js';
import { checkInsRouter } from './routes/checkins.js';
import { invitesRouter } from './routes/invites.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/', (_req, res) => {
    res.json({ name: 'StreakPot API', status: 'ok', health: '/api/health' });
  });

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/challenges', challengesRouter);
  app.use('/api/checkins', checkInsRouter);
  app.use('/api/invites', invitesRouter);

  app.use((_req, _res, next) => next(notFound()));
  app.use(errorHandler);
  return app;
}
