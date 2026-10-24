import { OrgState, PulseLevel, PulseSnapshot } from './types.js';
import { estimateForNewArrival } from './eta.js';

export function getPulseLevel(waitingCount: number, org: OrgState): PulseLevel {
  const { calmMax, busyMax } = org.settings;
  if (waitingCount <= calmMax) {
    return 'calm';
  }
  if (waitingCount <= busyMax) {
    return 'busy';
  }
  return 'critical';
}

export function isEtaRising(snapshots: PulseSnapshot[]): boolean {
  if (snapshots.length < 3) {
    return false;
  }
  const last3 = snapshots.slice(-3);
  const [s1, s2, s3] = last3;
  if (s1.newArrivalEta === null || s2.newArrivalEta === null || s3.newArrivalEta === null) {
    return false;
  }
  return s2.newArrivalEta >= s1.newArrivalEta && s3.newArrivalEta >= s2.newArrivalEta && s3.newArrivalEta > s1.newArrivalEta;
}

export function getPulse(org: OrgState, serviceId: string, now: number): {
  level: PulseLevel;
  waiting: number;
  newArrivalEta: number | null;
  compatibleOpen: number;
  reason: string;
  rising: boolean;
} {
  const service = org.services.find((s) => s.id === serviceId);
  const serviceName = service ? service.name : serviceId;

  const waiting = org.customers.filter((c) => c.status === 'waiting' && c.serviceId === serviceId).length;
  const level = getPulseLevel(waiting, org);
  const newArrivalEta = estimateForNewArrival(org, serviceId, now);

  const compatibleOpen = org.counters.filter(
    (c) => c.status !== 'closed' && c.serviceIds.includes(serviceId)
  ).length;

  const history = org.pulseHistory[serviceId] || [];
  const rising = isEtaRising(history);

  let reason = '';
  if (level === 'calm') {
    reason = `Calm. ${waiting} waiting for ${serviceName}. ${compatibleOpen} compatible counters open.`;
  } else if (level === 'busy') {
    if (newArrivalEta === null) {
      reason = `Busy. ${waiting} waiting for ${serviceName}. No compatible counter is open.`;
    } else {
      reason = `Busy. ${waiting} waiting for ${serviceName}. Estimated wait for a new arrival is ${newArrivalEta} minutes.`;
    }
  } else {
    const risingText = rising ? 'rising' : 'not rising';
    if (newArrivalEta === null) {
      reason = `Critical. ${waiting} waiting for ${serviceName}. No compatible counter is open.`;
    } else {
      reason = `Critical. ${waiting} waiting for ${serviceName}. Estimated wait for a new arrival is ${newArrivalEta} minutes and is ${risingText}.`;
    }
  }

  return {
    level,
    waiting,
    newArrivalEta,
    compatibleOpen,
    reason,
    rising,
  };
}
