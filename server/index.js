/**
 * Fastify backend — Performance Checker UI uchun API + WebSocket server.
 *
 * Endpointlar:
 *   GET    /api/health
 *   GET    /api/projects                 — Loyihalar ro'yxati
 *   POST   /api/projects                 — Yangi loyiha
 *   PUT    /api/projects/:id             — Yangilash
 *   DELETE /api/projects/:id             — O'chirish
 *   POST   /api/scans                    — Skan boshlash (jobId qaytaradi)
 *   GET    /api/scans                    — Joriy va o'tgan skanlar
 *   GET    /api/scans/:jobId             — Bitta skan holati
 *   POST   /api/scans/:jobId/cancel      — Skan to'xtatish
 *   GET    /api/reports/:scanId/*        — HTML/JSON hisobotlarni serve qilish
 *   GET    /api/history/:projectId       — Tarix snapshotlari (trend uchun)
 *   GET    /api/chrome/profiles          — Lokal Chrome profillar
 *   GET    /api/settings                 — Sozlamalar
 *   PUT    /api/settings                 — Sozlamalarni yangilash
 *   WS     /ws/jobs/:jobId               — Live log streaming
 */
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getDB } from './services/db.js';
import { jobRunner } from './services/job-runner.js';
import projectsRoutes from './routes/projects.js';
import scansRoutes from './routes/scans.js';
import jobsRoutes from './routes/jobs.js';
import reportsRoutes from './routes/reports.js';
import historyRoutes from './routes/history.js';
import chromeRoutes from './routes/chrome.js';
import settingsRoutes from './routes/settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

async function build() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'production' ? undefined : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss' },
      },
    },
  });

  // DB ni ishga tushirish
  fastify.decorate('db', getDB());
  fastify.decorate('jobs', jobRunner);

  await fastify.register(cors, {
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  });

  await fastify.register(websocket, {
    options: { maxPayload: 1048576 },
  });

  // Hisobot fayllariga to'g'ridan-to'g'ri kirish (HTML iframe uchun)
  const reportsRoot = resolve(__dirname, '../perf-reports');
  await fastify.register(fastifyStatic, {
    root: reportsRoot,
    prefix: '/reports-static/',
    decorateReply: false,
  });

  // Routes
  fastify.get('/api/health', async () => ({ ok: true, ts: Date.now() }));
  await fastify.register(projectsRoutes, { prefix: '/api/projects' });
  await fastify.register(scansRoutes, { prefix: '/api/scans' });
  await fastify.register(jobsRoutes); // WS '/ws/jobs/:id'
  await fastify.register(reportsRoutes, { prefix: '/api/reports' });
  await fastify.register(historyRoutes, { prefix: '/api/history' });
  await fastify.register(chromeRoutes, { prefix: '/api/chrome' });
  await fastify.register(settingsRoutes, { prefix: '/api/settings' });

  fastify.setErrorHandler((err, req, reply) => {
    req.log.error(err);
    const status = err.statusCode || 500;
    reply.status(status).send({
      error: err.name || 'Error',
      message: err.message,
      ...(err.issues ? { issues: err.issues } : {}),
    });
  });

  return fastify;
}

const app = await build();

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Performance Checker UI server: http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

const shutdown = async (signal) => {
  app.log.info(`${signal} — server to'xtatilmoqda...`);
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
