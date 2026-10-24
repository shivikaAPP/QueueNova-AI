// apps/api/src/routes/admin.ts
// Admin API routes per architecture.md section 14.
// All routes require session cookie. Mutating routes require X-Requested-With header.

import type { FastifyInstance } from 'fastify';
import {
  getStatsOverview,
  getFlowScore,
} from '@queuenova/queue-engine';
import { dispatchAction, getCachedState, resetOrgDemo } from '../state-manager.js';
import {
  loginSchema,
  addCounterSchema,
  setCounterServicesSchema,
  updateSettingsSchema,
  recallMissedSchema,
} from '../schemas.js';
import {
  verifyPasscode,
  createSessionCookie,
  clearSessionCookie,
  requireAdmin,
} from '../auth.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // POST /admin/login
  app.post('/admin/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      });
    }

    if (!verifyPasscode(parsed.data.passcode)) {
      return reply.status(401).send({
        error: { code: 'FORBIDDEN', message: 'Invalid passcode.' },
      });
    }

    createSessionCookie(reply);
    return reply.send({ ok: true });
  });

  // POST /admin/logout
  app.post('/admin/logout', async (_req, reply) => {
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });

  // All admin routes below require authentication
  app.addHook('preHandler', requireAdmin);

  // GET /orgs/:orgId/admin/state -- full org state including names
  app.get<{ Params: { orgId: string } }>('/orgs/:orgId/admin/state', async (req, reply) => {
    const { orgId } = req.params;
    const state = getCachedState(orgId);
    if (!state) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Organisation not found.' } });
    }

    const org = state.orgs[orgId];
    if (!org) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Organisation not found.' } });
    }

    return reply.send(org);
  });

  // POST /orgs/:orgId/counters/:counterId/call-next
  app.post<{ Params: { orgId: string; counterId: string } }>(
    '/orgs/:orgId/counters/:counterId/call-next',
    async (req, reply) => {
      const { orgId, counterId } = req.params;
      return handleAction(orgId, { type: 'callNext', orgId, counterId }, reply);
    }
  );

  // POST /orgs/:orgId/counters/:counterId/start
  app.post<{ Params: { orgId: string; counterId: string } }>(
    '/orgs/:orgId/counters/:counterId/start',
    async (req, reply) => {
      const { orgId, counterId } = req.params;
      return handleAction(orgId, { type: 'startService', orgId, counterId }, reply);
    }
  );

  // POST /orgs/:orgId/counters/:counterId/complete
  app.post<{ Params: { orgId: string; counterId: string } }>(
    '/orgs/:orgId/counters/:counterId/complete',
    async (req, reply) => {
      const { orgId, counterId } = req.params;
      return handleAction(orgId, { type: 'completeService', orgId, counterId }, reply);
    }
  );

  // POST /orgs/:orgId/counters/:counterId/miss
  app.post<{ Params: { orgId: string; counterId: string } }>(
    '/orgs/:orgId/counters/:counterId/miss',
    async (req, reply) => {
      const { orgId, counterId } = req.params;
      return handleAction(orgId, { type: 'markMissed', orgId, counterId }, reply);
    }
  );

  // POST /orgs/:orgId/counters/:counterId/open
  app.post<{ Params: { orgId: string; counterId: string } }>(
    '/orgs/:orgId/counters/:counterId/open',
    async (req, reply) => {
      const { orgId, counterId } = req.params;
      return handleAction(orgId, { type: 'openCounter', orgId, counterId }, reply);
    }
  );

  // POST /orgs/:orgId/counters/:counterId/close
  app.post<{ Params: { orgId: string; counterId: string } }>(
    '/orgs/:orgId/counters/:counterId/close',
    async (req, reply) => {
      const { orgId, counterId } = req.params;
      return handleAction(orgId, { type: 'closeCounter', orgId, counterId }, reply);
    }
  );

  // POST /orgs/:orgId/counters -- add counter
  app.post<{ Params: { orgId: string } }>('/orgs/:orgId/counters', async (req, reply) => {
    const { orgId } = req.params;
    const parsed = addCounterSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      });
    }

    return handleAction(orgId, { type: 'addCounter', orgId, ...parsed.data }, reply);
  });

  // PATCH /orgs/:orgId/counters/:counterId -- set counter services
  app.patch<{ Params: { orgId: string; counterId: string } }>(
    '/orgs/:orgId/counters/:counterId',
    async (req, reply) => {
      const { orgId, counterId } = req.params;
      const parsed = setCounterServicesSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
        });
      }

      return handleAction(
        orgId,
        { type: 'setCounterServices', orgId, counterId, serviceIds: parsed.data.serviceIds },
        reply
      );
    }
  );

  // POST /orgs/:orgId/tokens/:tokenId/recall
  app.post<{ Params: { orgId: string; tokenId: string } }>(
    '/orgs/:orgId/tokens/:tokenId/recall',
    async (req, reply) => {
      const { orgId, tokenId } = req.params;
      const parsed = recallMissedSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
        });
      }

      return handleAction(
        orgId,
        { type: 'recallMissed', orgId, tokenId, counterId: parsed.data.counterId },
        reply
      );
    }
  );

  // POST /orgs/:orgId/tokens/:tokenId/return
  app.post<{ Params: { orgId: string; tokenId: string } }>(
    '/orgs/:orgId/tokens/:tokenId/return',
    async (req, reply) => {
      const { orgId, tokenId } = req.params;
      return handleAction(orgId, { type: 'returnMissedToQueue', orgId, tokenId }, reply);
    }
  );

  // POST /orgs/:orgId/tokens/:tokenId/skip
  app.post<{ Params: { orgId: string; tokenId: string } }>(
    '/orgs/:orgId/tokens/:tokenId/skip',
    async (req, reply) => {
      const { orgId, tokenId } = req.params;
      return handleAction(orgId, { type: 'skip', orgId, tokenId }, reply);
    }
  );

  // POST /orgs/:orgId/tokens/:tokenId/approve-priority
  app.post<{ Params: { orgId: string; tokenId: string } }>(
    '/orgs/:orgId/tokens/:tokenId/approve-priority',
    async (req, reply) => {
      const { orgId, tokenId } = req.params;
      return handleAction(orgId, { type: 'approvePriority', orgId, tokenId }, reply);
    }
  );

  // POST /orgs/:orgId/tokens/:tokenId/reject-priority
  app.post<{ Params: { orgId: string; tokenId: string } }>(
    '/orgs/:orgId/tokens/:tokenId/reject-priority',
    async (req, reply) => {
      const { orgId, tokenId } = req.params;
      return handleAction(orgId, { type: 'rejectPriority', orgId, tokenId }, reply);
    }
  );

  // PATCH /orgs/:orgId/settings
  app.patch<{ Params: { orgId: string } }>('/orgs/:orgId/settings', async (req, reply) => {
    const { orgId } = req.params;
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      });
    }

    return handleAction(orgId, { type: 'updateSettings', orgId, patch: parsed.data }, reply);
  });

  // GET /orgs/:orgId/stats
  app.get<{ Params: { orgId: string } }>('/orgs/:orgId/stats', async (req, reply) => {
    const { orgId } = req.params;
    const state = getCachedState(orgId);
    if (!state) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Organisation not found.' } });
    }

    const org = state.orgs[orgId];
    if (!org) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Organisation not found.' } });
    }

    const now = Date.now();
    const overview = getStatsOverview(org, now);
    const flowScore = getFlowScore(org);

    return reply.send({
      ...overview,
      flowScore,
    });
  });

  // POST /orgs/:orgId/demo/reset -- only when DEMO_MODE=true
  app.post<{ Params: { orgId: string } }>('/orgs/:orgId/demo/reset', async (req, reply) => {
    if (process.env['DEMO_MODE'] !== 'true') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Demo reset is not enabled.' },
      });
    }

    const { orgId } = req.params;
    const state = await resetOrgDemo(orgId);
    return reply.send({ ok: true });
  });
}

async function handleAction(
  orgId: string,
  action: Parameters<typeof dispatchAction>[1],
  reply: ReturnType<Parameters<typeof adminRoutes>[0]['get']> extends Promise<infer R> ? any : any
) {
  const result = await dispatchAction(orgId, action);
  if (!result.ok) {
    const status = errorCodeToStatus(result.code);
    return reply.status(status).send({ error: { code: result.code, message: result.message } });
  }
  return reply.send({ ok: true });
}

function errorCodeToStatus(code: string): number {
  switch (code) {
    case 'VALIDATION': return 400;
    case 'FORBIDDEN': return 403;
    case 'NOT_FOUND': return 404;
    case 'INVALID_STATE': return 409;
    case 'COUNTER_BUSY': return 409;
    case 'COUNTER_CLOSED': return 409;
    case 'LAST_ACTIVE_COUNTER': return 409;
    case 'NO_ELIGIBLE_TOKEN': return 409;
    case 'NO_COMPATIBLE_COUNTER': return 409;
    case 'SLOT_FULL': return 409;
    case 'SLOT_OUT_OF_WINDOW': return 409;
    case 'QUEUE_FULL': return 429;
    default: return 500;
  }
}
