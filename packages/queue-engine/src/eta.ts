import { OrgState, Customer } from './types.js';
import { compareWaitingCustomers } from './order.js';

export function getAvgServiceMinutes(org: OrgState, serviceId: string): number {
  const matchingRecords = org.records
    .filter((r) => r.serviceId === serviceId)
    .slice(-10);

  if (matchingRecords.length === 0) {
    const service = org.services.find((s) => s.id === serviceId);
    return service ? service.defaultMinutes : 5;
  }

  const sum = matchingRecords.reduce((acc, r) => acc + r.durationMinutes, 0);
  return sum / matchingRecords.length;
}

export function estimateWaitFor(org: OrgState, tokenId: string, now: number): number | null {
  const target = org.customers.find((c) => c.token === tokenId || c.id === tokenId);
  if (!target || target.status !== 'waiting') {
    return null;
  }

  const compatibleCounters = org.counters.filter(
    (c) => c.status !== 'closed' && c.serviceIds.includes(target.serviceId)
  );

  if (compatibleCounters.length === 0) {
    return null;
  }

  const nonClosedCounters = org.counters.filter((c) => c.status !== 'closed');
  const free: Record<string, number> = {};

  for (const counter of nonClosedCounters) {
    if (counter.status === 'available') {
      free[counter.id] = 0;
    } else {
      const activeToken = org.customers.find((c) => c.id === counter.currentTokenId || c.token === counter.currentTokenId);
      if (activeToken) {
        const started = activeToken.servingStartedAt ?? activeToken.calledAt ?? now;
        const elapsedMinutes = Math.max(0, (now - started) / 60000);
        const avg = getAvgServiceMinutes(org, activeToken.serviceId);
        free[counter.id] = Math.max(0, avg - elapsedMinutes);
      } else {
        free[counter.id] = 0;
      }
    }
  }

  const waitingCustomers = org.customers
    .filter((c) => c.status === 'waiting')
    .sort(compareWaitingCustomers);

  const targetIndex = waitingCustomers.findIndex((c) => c.id === target.id);
  const ahead = targetIndex >= 0 ? waitingCustomers.slice(0, targetIndex) : [];

  for (const t of ahead) {
    const candidates = nonClosedCounters.filter((c) => c.serviceIds.includes(t.serviceId));
    if (candidates.length === 0) {
      continue;
    }

    candidates.sort((a, b) => {
      const diff = free[a.id] - free[b.id];
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    const best = candidates[0];
    const avg = getAvgServiceMinutes(org, t.serviceId);
    free[best.id] = free[best.id] + avg;
  }

  const compatibleMins = compatibleCounters.map((c) => free[c.id]);
  const minFree = Math.min(...compatibleMins);

  return Math.ceil(minFree);
}

export function estimateForNewArrival(org: OrgState, serviceId: string, now: number): number | null {
  const virtualCustomer: Customer = {
    id: 'virtual-arrival',
    token: 'QN-99999',
    cancelSecret: '',
    name: 'Virtual Arrival',
    serviceId,
    joinedAt: now,
    queueTime: now,
    slotId: null,
    priority: 'none',
    status: 'waiting',
    counterId: null,
    calledAt: null,
    servingStartedAt: null,
    completedAt: null,
    missedAt: null,
    missedCount: 0,
    estimateAtJoin: null,
    estimatedWaitMinutes: null,
    lastNotifiedEta: null,
    approachingNotified: false,
  };

  const compatibleCounters = org.counters.filter(
    (c) => c.status !== 'closed' && c.serviceIds.includes(serviceId)
  );

  if (compatibleCounters.length === 0) {
    return null;
  }

  const nonClosedCounters = org.counters.filter((c) => c.status !== 'closed');
  const free: Record<string, number> = {};

  for (const counter of nonClosedCounters) {
    if (counter.status === 'available') {
      free[counter.id] = 0;
    } else {
      const activeToken = org.customers.find((c) => c.id === counter.currentTokenId || c.token === counter.currentTokenId);
      if (activeToken) {
        const started = activeToken.servingStartedAt ?? activeToken.calledAt ?? now;
        const elapsedMinutes = Math.max(0, (now - started) / 60000);
        const avg = getAvgServiceMinutes(org, activeToken.serviceId);
        free[counter.id] = Math.max(0, avg - elapsedMinutes);
      } else {
        free[counter.id] = 0;
      }
    }
  }

  const waitingCustomers = org.customers
    .filter((c) => c.status === 'waiting')
    .concat([virtualCustomer])
    .sort(compareWaitingCustomers);

  const targetIndex = waitingCustomers.findIndex((c) => c.id === virtualCustomer.id);
  const ahead = targetIndex >= 0 ? waitingCustomers.slice(0, targetIndex) : [];

  for (const t of ahead) {
    const candidates = nonClosedCounters.filter((c) => c.serviceIds.includes(t.serviceId));
    if (candidates.length === 0) {
      continue;
    }

    candidates.sort((a, b) => {
      const diff = free[a.id] - free[b.id];
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    const best = candidates[0];
    const avg = getAvgServiceMinutes(org, t.serviceId);
    free[best.id] = free[best.id] + avg;
  }

  const compatibleMins = compatibleCounters.map((c) => free[c.id]);
  const minFree = Math.min(...compatibleMins);

  return Math.ceil(minFree);
}

export function getPeopleAhead(org: OrgState, tokenId: string): number {
  const target = org.customers.find((c) => c.token === tokenId || c.id === tokenId);
  if (!target || target.status !== 'waiting') {
    return 0;
  }

  const waiting = org.customers
    .filter((c) => c.status === 'waiting')
    .sort(compareWaitingCustomers);

  const targetIndex = waiting.findIndex((c) => c.id === target.id);
  if (targetIndex <= 0) return 0;

  const ahead = waiting.slice(0, targetIndex);
  return ahead.filter((c) => c.serviceId === target.serviceId).length;
}

export function getReturnWindow(estimate: number | null): { text: string; start?: number; end?: number } | null {
  if (estimate === null) {
    return null;
  }
  if (estimate <= 5) {
    return { text: 'Stay nearby, your turn is close' };
  }
  const start = estimate - 5;
  const end = estimate - 3;
  return {
    start,
    end,
    text: `Come back in ${start} to ${end} minutes`,
  };
}
