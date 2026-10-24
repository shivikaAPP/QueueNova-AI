// apps/api/src/routes/public.ts
// Public API routes per architecture.md section 14.
// No authentication required.

import type { FastifyInstance } from 'fastify';
import {
  estimateForNewArrival,
  estimateWaitFor,
  getConfidence,
  getPeopleAhead,
  getPulse,
  getRecommendations,
  getReturnWindow,
  getFlowScore,
  getStatsOverview,
} from '@queuenova/queue-engine';
import type { OrgState, AppointmentSlot } from '@queuenova/queue-engine';
import { getCachedState, dispatchAction } from '../state-manager.js';
import { joinSchema, cancelSchema } from '../schemas.js';
import { addClient, removeClient } from '../sse.js';
import { loadState } from '../db.js';

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  // GET /orgs -- list organisations and services
  app.get('/orgs', async (_req, reply) => {
    // Load all orgs from cache
    const { getAllOrgIds, getCachedState: getState } = await import('../state-manager.js');
    const orgIds = getAllOrgIds();
    const orgs = [];

    for (const orgId of orgIds) {
      const state = getState(orgId);
      if (state) {
        const org = state.orgs[orgId];
        if (org) {
          orgs.push({
            id: org.id,
            name: org.name,
            services: org.services.map((s) => ({
              id: s.id,
              name: s.name,
              defaultMinutes: s.defaultMinutes,
            })),
          });
        }
      }
    }

    return reply.send(orgs);
  });

  // GET /orgs/:orgId/snapshot -- public queue snapshot for /live
  app.get<{ Params: { orgId: string } }>('/orgs/:orgId/snapshot', async (req, reply) => {
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
    const snapshot = buildSnapshot(org, now);
    return reply.send(snapshot);
  });

  // POST /orgs/:orgId/tokens -- join queue
  app.post<{ Params: { orgId: string } }>('/orgs/:orgId/tokens', async (req, reply) => {
    const { orgId } = req.params;
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      });
    }

    const { name, serviceId, slotId, requestPriority } = parsed.data;
    const result = await dispatchAction(orgId, {
      type: 'join',
      orgId,
      name,
      serviceId,
      slotId,
      requestPriority,
    });

    if (!result.ok) {
      const status = errorCodeToStatus(result.code);
      return reply.status(status).send({ error: { code: result.code, message: result.message } });
    }

    return reply.status(201).send({
      token: result.token,
      cancelSecret: result.cancelSecret,
    });
  });

  // GET /orgs/:orgId/tokens/:token -- pass view
  app.get<{ Params: { orgId: string; token: string } }>('/orgs/:orgId/tokens/:token', async (req, reply) => {
    const { orgId, token } = req.params;
    const state = getCachedState(orgId);
    if (!state) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Organisation not found.' } });
    }

    const org = state.orgs[orgId];
    if (!org) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Organisation not found.' } });
    }

    const customer = org.customers.find((c) => c.token === token);
    if (!customer) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Token not found.' } });
    }

    const now = Date.now();
    const estimate = estimateWaitFor(org, customer.id, now);
    const peopleAhead = getPeopleAhead(org, customer.id);
    const returnWindow = getReturnWindow(estimate);
    const confidence = getConfidence(org, customer.serviceId, now);
    const service = org.services.find((s) => s.id === customer.serviceId);
    const counter = customer.counterId ? org.counters.find((c) => c.id === customer.counterId) : null;
    const notifications = org.notifications
      .filter((n) => n.tokenId === customer.id)
      .sort((a, b) => b.createdAt - a.createdAt);

    return reply.send({
      token: customer.token,
      status: customer.status,
      service: service ? { id: service.id, name: service.name } : null,
      peopleAhead,
      estimatedWaitMinutes: estimate,
      returnWindow: returnWindow ? { text: returnWindow.text, start: returnWindow.start, end: returnWindow.end } : null,
      confidence,
      serving: counter ? { counterName: counter.name } : null,
      notifications: notifications.map((n) => ({
        id: n.id,
        kind: n.kind,
        message: n.message,
        createdAt: n.createdAt,
        read: n.read,
      })),
    });
  });

  // POST /orgs/:orgId/tokens/:token/cancel -- cancel token
  app.post<{ Params: { orgId: string; token: string } }>('/orgs/:orgId/tokens/:token/cancel', async (req, reply) => {
    const { orgId, token } = req.params;
    const parsed = cancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      });
    }

    const state = getCachedState(orgId);
    if (!state) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Organisation not found.' } });
    }

    const org = state.orgs[orgId];
    if (!org) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Organisation not found.' } });
    }

    const customer = org.customers.find((c) => c.token === token);
    if (!customer) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Token not found.' } });
    }

    const result = await dispatchAction(orgId, {
      type: 'cancel',
      orgId,
      tokenId: customer.id,
      cancelSecret: parsed.data.cancelSecret,
    });

    if (!result.ok) {
      const status = errorCodeToStatus(result.code);
      return reply.status(status).send({ error: { code: result.code, message: result.message } });
    }

    return reply.send({ ok: true });
  });

  // GET /orgs/:orgId/events -- Server-Sent Events
  app.get<{ Params: { orgId: string } }>('/orgs/:orgId/events', async (req, reply) => {
    const { orgId } = req.params;
    const state = getCachedState(orgId);
    if (!state) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Organisation not found.' } });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write('\n');

    addClient(orgId, reply);

    req.raw.on('close', () => {
      removeClient(reply);
    });

    // Keep the connection open
    reply.hijack();
  });

  // GET /orgs/:orgId/slots -- appointment slots
  app.get<{ Params: { orgId: string } }>('/orgs/:orgId/slots', async (req, reply) => {
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
    const slots = org.slots.map((slot) => ({
      id: slot.id,
      serviceId: slot.serviceId,
      startsAt: slot.startsAt,
      capacity: slot.capacity,
      isValid: isSlotValid(slot, org, now),
      currentUsage: org.customers.filter(
        (c) => c.slotId === slot.id && c.status !== 'cancelled'
      ).length,
    }));

    return reply.send(slots);
  });

  // GET /healthz
  app.get('/healthz', async (_req, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

function isSlotValid(slot: AppointmentSlot, org: OrgState, now: number): boolean {
  const earlyMs = (org.settings.appointmentEarlyMinutes ?? 10) * 60000;
  const lateMs = (org.settings.appointmentLateMinutes ?? 15) * 60000;
  return now >= slot.startsAt - earlyMs && now <= slot.startsAt + lateMs;
}

function buildSnapshot(org: OrgState, now: number) {
  const counters = org.counters.map((c) => {
    const servingCustomer = c.currentTokenId
      ? org.customers.find((cust) => cust.id === c.currentTokenId)
      : null;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      currentToken: servingCustomer ? servingCustomer.token : null,
      serviceIds: c.serviceIds,
    };
  });

  const waitingCounts: Record<string, number> = {};
  for (const service of org.services) {
    waitingCounts[service.id] = org.customers.filter(
      (c) => c.status === 'waiting' && c.serviceId === service.id
    ).length;
  }

  const pulseByService: Record<string, ReturnType<typeof getPulse>> = {};
  for (const service of org.services) {
    pulseByService[service.id] = getPulse(org, service.id, now);
  }

  const recommendations = getRecommendations(org, now);

  const newArrivalEstimates: Record<string, number | null> = {};
  for (const service of org.services) {
    newArrivalEstimates[service.id] = estimateForNewArrival(org, service.id, now);
  }

  const recentActivity = org.activity
    .sort((a, b) => b.at - a.at)
    .slice(0, 20)
    .map((a) => ({ id: a.id, at: a.at, text: a.text }));

  return {
    counters,
    waitingCounts,
    services: org.services.map((s) => ({ id: s.id, name: s.name })),
    pulse: pulseByService,
    recommendations,
    newArrivalEstimates,
    recentActivity,
  };
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
