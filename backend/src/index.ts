import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { config } from './config';
import { setupPassport } from './auth/passport';
import { setupBullBoard } from './config/bullBoard';
import { initElasticsearch } from './config/elasticsearch';
import { startEmailWorker } from './queue/emailWorker';
import { recoverPendingJobs, recoverPastDueJobs } from './queue/persistence';

// Routes
import authRoutes from './routes/auth.routes';
import emailRoutes from './routes/email.routes';
import senderRoutes from './routes/sender.routes';
import slackRoutes from './routes/slack.routes';

import fs from 'fs';
import path from 'path';

const app = express();

// Enable trust proxy for Render / Cloud hosting behind reverse proxies
app.set('trust proxy', 1);

// === Middleware ===
const allowedOrigins = [
  config.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      // Allow any onrender.com origin
      if (origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// === Passport ===
setupPassport();
app.use(passport.initialize());

// === BullMQ Dashboard ===
const bullBoardAdapter = setupBullBoard();
app.use('/admin/queues', bullBoardAdapter.getRouter());

// === API Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/slack', slackRoutes);

// === Health Check ===
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// === Static Frontend Serving (Optional / Production Full-Stack mode) ===
const frontendDistPaths = [
  path.join(__dirname, '../../frontend/dist'),
  path.join(__dirname, '../public'),
  path.join(process.cwd(), 'frontend/dist'),
  path.join(process.cwd(), 'public'),
];

for (const distPath of frontendDistPaths) {
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`📦 Serving static frontend from: ${distPath}`);
    break;
  }
}

// === Error Handler ===
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

// === Start Server ===
async function start() {
  try {
    // Initialize Elasticsearch (non-blocking)
    initElasticsearch().catch(console.error);

    // Start BullMQ worker
    startEmailWorker();

    // Recover pending jobs from previous runs
    await recoverPendingJobs();
    await recoverPastDueJobs();

    app.listen(config.PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║     🚀 ReachInbox Email Scheduler Backend         ║
║                                                   ║
║     API:        http://localhost:${config.PORT}           ║
║     BullMQ UI:  http://localhost:${config.PORT}/admin/queues ║
║     Worker:     Running (concurrency: ${config.WORKER_CONCURRENCY})        ║
║                                                   ║
║     Rate Limits:                                  ║
║       Global:     ${config.MAX_EMAILS_PER_HOUR}/hr                       ║
║       Per-Sender: ${config.MAX_EMAILS_PER_HOUR_PER_SENDER}/hr                        ║
║       Min Delay:  ${config.MIN_DELAY_BETWEEN_EMAILS_MS}ms                       ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});
