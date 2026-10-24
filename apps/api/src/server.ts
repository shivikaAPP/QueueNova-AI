// apps/api/src/server.ts
// Main Fastify server entry point.
// architecture.md sections 14, 16. techstack.md section 4.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { initDb, closeDb } from './db.js';
import { initStateCache, seedIfEmpty, tickOrg, getAllOrgIds } from './state-manager.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';

const PORT = parseInt(process.env['PORT'] || '3001', 10);
const HOST = process.env['HOST'] || '0.0.0.0';
const CORS_ORIGIN = process.env['CORS_ORIGIN'] || 'http://localhost:5173';
const isDemoMode = process.env['DEMO_MODE'] === 'true';

async function start(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] || 'info',
      // Never log names or secrets (architecture.md section 16)
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
          };
        },
      },
    },
    bodyLimit: 10240, // 10 KB body limit (architecture.md section 16)
  });

  // Register plugins
  await app.register(cors, {
    origin: CORS_ORIGIN,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // CSP handled by _headers on the static site
  });

  await app.register(rateLimit, {
    global: false,
  });

  await app.register(cookie);

  // Rate limit on login: 5 per 15 minutes per IP (architecture.md section 16)
  app.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url === '/api/v1/admin/login' && routeOptions.method === 'POST') {
      routeOptions.config = {
        ...routeOptions.config,
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
        },
      };
    }
  });

  // Rate limit on join: 10 per minute per IP (architecture.md section 14)
  // Applied via route-level config
  app.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url?.match(/\/orgs\/[^/]+\/tokens$/) && routeOptions.method === 'POST') {
      routeOptions.config = {
        ...routeOptions.config,
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      };
    }
  });

  // Register route groups under /api/v1
  await app.register(publicRoutes, { prefix: '/api/v1' });
  await app.register(adminRoutes, { prefix: '/api/v1' });

  // Initialize database and state
  await initDb();
  await seedIfEmpty();
  await initStateCache();

  // Tick every 15 seconds for each active org (architecture.md section 14)
  const tickInterval = setInterval(async () => {
    const orgIds = getAllOrgIds();
    for (const orgId of orgIds) {
      try {
        await tickOrg(orgId);
      } catch (err) {
        app.log.error({ orgId }, 'Tick failed for organisation');
      }
    }
  }, 15000);

  // Graceful shutdown
  const shutdown = async () => {
    clearInterval(tickInterval);
    await app.close();
    await closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  await app.listen({ port: PORT, host: HOST });
  app.log.info(
    `QueueNova API running on ${HOST}:${PORT} (demo mode: ${isDemoMode})`
  );
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
