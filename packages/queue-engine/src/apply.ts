import {
  AppState,
  OrgState,
  Action,
  Result,
  Customer,
  PulseSnapshot,
  Counter,
  Notification,
} from './types.js';
import { isSlotValidNow, compareWaitingCustomers } from './order.js';
import { estimateWaitFor, estimateForNewArrival, getPeopleAhead } from './eta.js';
import { getPulse } from './pulse.js';
import { createNotification, formatTime } from './notify.js';

function generateSecret(random: () => number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < 8; i++) {
    const idx = Math.floor(random() * chars.length);
    res += chars[idx];
  }
  return res;
}

export function apply(
  state: AppState,
  action: Action,
  now: number,
  random: () => number = Math.random
): Result {
  // Deep clone to guarantee immutability
  const nextState: AppState = JSON.parse(JSON.stringify(state));

  const org = nextState.orgs[action.orgId];
  if (!org) {
    return { ok: false, code: 'NOT_FOUND', message: 'Organisation not found.' };
  }

  const addNotification = (
    kind: Notification['kind'],
    message: string,
    tokenId: string | null = null
  ) => {
    const seq = org.notifications.length + 1;
    org.notifications.unshift(createNotification(kind, message, now, tokenId, seq));
  };

  let generatedToken: string | undefined;
  let generatedSecret: string | undefined;
  let closedCounterName: string | undefined;

  switch (action.type) {
    case 'join': {
      const name = action.name.trim();
      // Name 1 to 60 characters, no control characters
      if (name.length < 1 || name.length > 60 || /[\x00-\x1F\x7F]/.test(name)) {
        return {
          ok: false,
          code: 'VALIDATION',
          message: 'Name must be between 1 and 60 characters with no control characters.',
        };
      }

      const service = org.services.find((s) => s.id === action.serviceId);
      if (!service) {
        return { ok: false, code: 'NOT_FOUND', message: 'Service not found.' };
      }

      let slotId: string | null = null;
      if (action.slotId) {
        const slot = org.slots.find((s) => s.id === action.slotId && s.serviceId === action.serviceId);
        if (!slot) {
          return { ok: false, code: 'NOT_FOUND', message: 'Appointment slot not found.' };
        }

        if (!isSlotValidNow(slot, org.settings, now)) {
          return {
            ok: false,
            code: 'SLOT_OUT_OF_WINDOW',
            message: 'This slot is outside its window. You can join as a walk-in instead.',
          };
        }

        const slotUsers = org.customers.filter((c) => c.slotId === slot.id && c.status !== 'cancelled');
        if (slotUsers.length >= slot.capacity) {
          return { ok: false, code: 'SLOT_FULL', message: 'Appointment slot is fully booked.' };
        }

        slotId = slot.id;
      }

      const waitingCount = org.customers.filter((c) => c.status === 'waiting').length;
      if (waitingCount >= org.settings.maxWaiting) {
        return {
          ok: false,
          code: 'QUEUE_FULL',
          message: 'The queue is currently full. Please try again later.',
        };
      }

      const tokenStr = `QN-${nextState.nextSeq}`;
      nextState.nextSeq += 1;
      const secret = generateSecret(random);

      const customer: Customer = {
        id: `cust-${now}-${tokenStr}`,
        token: tokenStr,
        cancelSecret: secret,
        name,
        serviceId: action.serviceId,
        joinedAt: now,
        queueTime: now,
        slotId,
        priority: action.requestPriority ? 'pending' : 'none',
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

      org.customers.push(customer);
      org.stats.registrations += 1;

      // Calculate initial estimate
      const est = estimateWaitFor(org, customer.token, now);
      customer.estimateAtJoin = est;
      customer.estimatedWaitMinutes = est;
      customer.lastNotifiedEta = est;

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `Token ${customer.token} joined for ${service.name}.`,
      });

      generatedToken = customer.token;
      generatedSecret = secret;
      break;
    }

    case 'callNext': {
      const counter = org.counters.find((c) => c.id === action.counterId);
      if (!counter) {
        return { ok: false, code: 'NOT_FOUND', message: 'Counter not found.' };
      }

      if (counter.status === 'closed') {
        return { ok: false, code: 'COUNTER_CLOSED', message: 'Counter is closed.' };
      }

      if (counter.status === 'serving' || counter.currentTokenId !== null) {
        return { ok: false, code: 'COUNTER_BUSY', message: 'Counter is currently serving a token.' };
      }

      const eligible = org.customers
        .filter((c) => c.status === 'waiting' && counter.serviceIds.includes(c.serviceId))
        .sort(compareWaitingCustomers);

      if (eligible.length === 0) {
        return { ok: false, code: 'NO_ELIGIBLE_TOKEN', message: 'No eligible tokens waiting for this counter.' };
      }

      const nextCustomer = eligible[0];
      nextCustomer.status = 'called';
      nextCustomer.counterId = counter.id;
      nextCustomer.calledAt = now;

      counter.status = 'serving';
      counter.currentTokenId = nextCustomer.id;

      org.counterLog.push({
        counterId: counter.id,
        status: 'serving',
        at: now,
      });

      addNotification(
        'called',
        `Token ${nextCustomer.token} is called. Please go to ${counter.name}.`,
        nextCustomer.token
      );

      org.activity.unshift({
        id: `act-${now}-${nextCustomer.token}`,
        at: now,
        text: `Token ${nextCustomer.token} called to ${counter.name}.`,
      });
      break;
    }

    case 'startService': {
      const counter = org.counters.find((c) => c.id === action.counterId);
      if (!counter) {
        return { ok: false, code: 'NOT_FOUND', message: 'Counter not found.' };
      }

      const customer = org.customers.find((c) => c.id === counter.currentTokenId && c.status === 'called');
      if (!customer) {
        return { ok: false, code: 'INVALID_STATE', message: 'No token currently called at this counter.' };
      }

      customer.status = 'serving';
      customer.servingStartedAt = now;

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `${counter.name} started service for ${customer.token}.`,
      });
      break;
    }

    case 'completeService': {
      const counter = org.counters.find((c) => c.id === action.counterId);
      if (!counter) {
        return { ok: false, code: 'NOT_FOUND', message: 'Counter not found.' };
      }

      const customer = org.customers.find(
        (c) => c.id === counter.currentTokenId && (c.status === 'serving' || c.status === 'called')
      );
      if (!customer) {
        return { ok: false, code: 'INVALID_STATE', message: 'No active service to complete at this counter.' };
      }

      customer.status = 'completed';
      customer.completedAt = now;

      counter.status = 'available';
      counter.currentTokenId = null;

      const started = customer.servingStartedAt ?? customer.calledAt ?? now;
      const duration = Math.max(0.1, (now - started) / 60000);
      const actualWait = Math.max(0, ((customer.calledAt ?? now) - customer.joinedAt) / 60000);

      org.records.push({
        tokenId: customer.token,
        serviceId: customer.serviceId,
        counterId: counter.id,
        startedAt: started,
        endedAt: now,
        durationMinutes: Math.round(duration * 10) / 10,
        estimateAtJoin: customer.estimateAtJoin,
        actualWaitMinutes: Math.round(actualWait * 10) / 10,
        simulated: false,
      });

      org.counterLog.push({
        counterId: counter.id,
        status: 'available',
        at: now,
      });

      org.stats.completed += 1;

      addNotification(
        'completed',
        `Service for token ${customer.token} is complete. Thank you.`,
        customer.token
      );

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `${counter.name} completed service for ${customer.token}.`,
      });
      break;
    }

    case 'markMissed': {
      const counter = org.counters.find((c) => c.id === action.counterId);
      if (!counter) {
        return { ok: false, code: 'NOT_FOUND', message: 'Counter not found.' };
      }

      const customer = org.customers.find((c) => c.id === counter.currentTokenId && c.status === 'called');
      if (!customer) {
        return {
          ok: false,
          code: 'INVALID_STATE',
          message: 'Counter does not have a called customer to mark missed.',
        };
      }

      customer.status = 'missed';
      customer.missedAt = now;
      customer.missedCount += 1;

      counter.status = 'available';
      counter.currentTokenId = null;

      org.counterLog.push({
        counterId: counter.id,
        status: 'available',
        at: now,
      });

      const graceDeadline = now + org.settings.graceMinutes * 60000;
      const deadlineStr = formatTime(graceDeadline);

      addNotification(
        'missed',
        `Token ${customer.token} was marked missed. You can be recalled until ${deadlineStr}.`,
        customer.token
      );

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `Token ${customer.token} marked missed at ${counter.name}.`,
      });
      break;
    }

    case 'recallMissed': {
      const customer = org.customers.find((c) => (c.id === action.tokenId || c.token === action.tokenId) && c.status === 'missed');
      if (!customer) {
        return { ok: false, code: 'INVALID_STATE', message: 'Token is not marked missed.' };
      }

      const counter = org.counters.find((c) => c.id === action.counterId);
      if (!counter) {
        return { ok: false, code: 'NOT_FOUND', message: 'Counter not found.' };
      }

      if (counter.status === 'closed') {
        return { ok: false, code: 'COUNTER_CLOSED', message: 'Counter is closed.' };
      }

      if (counter.status === 'serving' || counter.currentTokenId !== null) {
        return { ok: false, code: 'COUNTER_BUSY', message: 'Counter is currently busy.' };
      }

      if (!counter.serviceIds.includes(customer.serviceId)) {
        return { ok: false, code: 'NO_COMPATIBLE_COUNTER', message: 'Counter does not support this service.' };
      }

      customer.status = 'called';
      customer.counterId = counter.id;
      customer.calledAt = now;

      counter.status = 'serving';
      counter.currentTokenId = customer.id;

      org.counterLog.push({
        counterId: counter.id,
        status: 'serving',
        at: now,
      });

      addNotification(
        'called',
        `Token ${customer.token} is called. Please go to ${counter.name}.`,
        customer.token
      );

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `Token ${customer.token} recalled to ${counter.name}.`,
      });
      break;
    }

    case 'returnMissedToQueue': {
      const customer = org.customers.find((c) => (c.id === action.tokenId || c.token === action.tokenId) && c.status === 'missed');
      if (!customer) {
        return { ok: false, code: 'INVALID_STATE', message: 'Token is not marked missed.' };
      }

      customer.status = 'waiting';
      customer.queueTime = now;
      customer.counterId = null;

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `Token ${customer.token} returned to queue.`,
      });
      break;
    }

    case 'skip': {
      const customer = org.customers.find((c) => (c.id === action.tokenId || c.token === action.tokenId) && c.status === 'waiting');
      if (!customer) {
        return { ok: false, code: 'INVALID_STATE', message: 'Only waiting tokens can be skipped.' };
      }

      customer.queueTime = now;

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `Token ${customer.token} skipped to end of its tier.`,
      });
      break;
    }

    case 'cancel': {
      const customer = org.customers.find((c) => c.id === action.tokenId || c.token === action.tokenId);
      if (!customer) {
        return { ok: false, code: 'NOT_FOUND', message: 'Token not found.' };
      }

      if (!['waiting', 'called', 'missed'].includes(customer.status)) {
        return {
          ok: false,
          code: 'INVALID_STATE',
          message: 'Cannot cancel this token in its current state.',
        };
      }

      if (!action.byStaff) {
        if (!action.cancelSecret || action.cancelSecret !== customer.cancelSecret) {
          return { ok: false, code: 'FORBIDDEN', message: 'Invalid cancellation secret.' };
        }
      }

      if (customer.counterId) {
        const counter = org.counters.find((c) => c.id === customer.counterId);
        if (counter && counter.currentTokenId === customer.id) {
          counter.status = 'available';
          counter.currentTokenId = null;
          org.counterLog.push({
            counterId: counter.id,
            status: 'available',
            at: now,
          });
        }
      }

      customer.status = 'cancelled';
      org.stats.cancelled += 1;

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `Token ${customer.token} was cancelled.`,
      });
      break;
    }

    case 'approvePriority': {
      const customer = org.customers.find((c) => (c.id === action.tokenId || c.token === action.tokenId) && c.status === 'waiting');
      if (!customer) {
        return { ok: false, code: 'INVALID_STATE', message: 'Token is not waiting.' };
      }

      customer.priority = 'approved';

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `Priority approved for token ${customer.token}.`,
      });
      break;
    }

    case 'rejectPriority': {
      const customer = org.customers.find((c) => (c.id === action.tokenId || c.token === action.tokenId) && c.status === 'waiting');
      if (!customer) {
        return { ok: false, code: 'INVALID_STATE', message: 'Token is not waiting.' };
      }

      customer.priority = 'rejected';

      org.activity.unshift({
        id: `act-${now}-${customer.token}`,
        at: now,
        text: `Priority rejected for token ${customer.token}.`,
      });
      break;
    }

    case 'openCounter': {
      const counter = org.counters.find((c) => c.id === action.counterId);
      if (!counter) {
        return { ok: false, code: 'NOT_FOUND', message: 'Counter not found.' };
      }

      counter.status = 'available';
      counter.currentTokenId = null;

      org.counterLog.push({
        counterId: counter.id,
        status: 'available',
        at: now,
      });

      org.activity.unshift({
        id: `act-${now}-${counter.id}`,
        at: now,
        text: `${counter.name} was opened.`,
      });
      break;
    }

    case 'closeCounter': {
      const counter = org.counters.find((c) => c.id === action.counterId);
      if (!counter) {
        return { ok: false, code: 'NOT_FOUND', message: 'Counter not found.' };
      }

      if (counter.status === 'serving' || counter.currentTokenId !== null) {
        const currentCust = org.customers.find((c) => c.id === counter.currentTokenId);
        const tok = currentCust ? currentCust.token : 'active token';
        return {
          ok: false,
          code: 'COUNTER_BUSY',
          message: `Cannot close while serving ${tok}. Complete the service first.`,
        };
      }

      const nonClosed = org.counters.filter((c) => c.status !== 'closed' && c.id !== counter.id);
      if (nonClosed.length === 0) {
        return {
          ok: false,
          code: 'LAST_ACTIVE_COUNTER',
          message: 'Cannot close the last active counter.',
        };
      }

      counter.status = 'closed';
      counter.currentTokenId = null;
      closedCounterName = counter.name;

      org.counterLog.push({
        counterId: counter.id,
        status: 'closed',
        at: now,
      });

      org.activity.unshift({
        id: `act-${now}-${counter.id}`,
        at: now,
        text: `${counter.name} was closed.`,
      });
      break;
    }

    case 'addCounter': {
      const name = action.name.trim();
      if (name.length < 1 || name.length > 30) {
        return {
          ok: false,
          code: 'VALIDATION',
          message: 'Counter name must be between 1 and 30 characters.',
        };
      }

      if (!action.serviceIds || action.serviceIds.length === 0) {
        return {
          ok: false,
          code: 'VALIDATION',
          message: 'Counter must support at least one service.',
        };
      }

      const allExist = action.serviceIds.every((sid) => org.services.some((s) => s.id === sid));
      if (!allExist) {
        return { ok: false, code: 'VALIDATION', message: 'One or more invalid services specified.' };
      }

      const newId = `counter-${org.counters.length + 1}`;
      const newCounter: Counter = {
        id: newId,
        name,
        serviceIds: [...action.serviceIds],
        status: 'available',
        currentTokenId: null,
      };

      org.counters.push(newCounter);

      org.counterLog.push({
        counterId: newId,
        status: 'available',
        at: now,
      });

      org.activity.unshift({
        id: `act-${now}-${newId}`,
        at: now,
        text: `Counter ${name} was added.`,
      });
      break;
    }

    case 'setCounterServices': {
      const counter = org.counters.find((c) => c.id === action.counterId);
      if (!counter) {
        return { ok: false, code: 'NOT_FOUND', message: 'Counter not found.' };
      }

      if (counter.status === 'serving' || counter.currentTokenId !== null) {
        return {
          ok: false,
          code: 'COUNTER_BUSY',
          message: 'Cannot change services while serving a token.',
        };
      }

      if (!action.serviceIds || action.serviceIds.length === 0) {
        return {
          ok: false,
          code: 'VALIDATION',
          message: 'Counter must support at least one service.',
        };
      }

      const allExist = action.serviceIds.every((sid) => org.services.some((s) => s.id === sid));
      if (!allExist) {
        return { ok: false, code: 'VALIDATION', message: 'One or more invalid services specified.' };
      }

      counter.serviceIds = [...action.serviceIds];

      org.activity.unshift({
        id: `act-${now}-${counter.id}`,
        at: now,
        text: `Services updated for ${counter.name}.`,
      });
      break;
    }

    case 'updateSettings': {
      org.settings = { ...org.settings, ...action.patch };
      break;
    }

    case 'tick': {
      // Grace period expiry check
      const graceMs = org.settings.graceMinutes * 60000;
      for (const customer of org.customers) {
        if (customer.status === 'missed' && customer.missedAt !== null) {
          if (now >= customer.missedAt + graceMs) {
            if (
              org.settings.missedPolicy === 'requeue_last_in_tier' &&
              customer.missedCount < org.settings.maxMisses
            ) {
              customer.status = 'waiting';
              customer.queueTime = now;
              customer.counterId = null;

              addNotification(
                'grace_expired',
                `Token ${customer.token} grace period ended and the token was requeued.`,
                null // staff notification
              );

              addNotification(
                'grace_expired',
                `Grace period for token ${customer.token} ended and the token was requeued.`,
                customer.token
              );
            } else {
              customer.status = 'expired';
              org.stats.expired += 1;

              addNotification(
                'grace_expired',
                `Token ${customer.token} grace period ended and the token was expired.`,
                null // staff notification
              );

              addNotification(
                'grace_expired',
                `Grace period for token ${customer.token} ended and the token was expired.`,
                customer.token
              );
            }
          }
        }
      }
      break;
    }
  }

  // Recalculate estimates and notification rules for all waiting customers
  const waitingCustomers = org.customers.filter((c) => c.status === 'waiting');
  for (const customer of waitingCustomers) {
    const newEta = estimateWaitFor(org, customer.token, now);
    const oldEta = customer.estimatedWaitMinutes;
    customer.estimatedWaitMinutes = newEta;

    const peopleAhead = getPeopleAhead(org, customer.token);
    const service = org.services.find((s) => s.id === customer.serviceId);
    const serviceName = service ? service.name : customer.serviceId;

    // Rule: Approaching notification
    if (peopleAhead <= org.settings.approachingAhead && !customer.approachingNotified) {
      customer.approachingNotified = true;
      addNotification(
        'approaching',
        `Your turn is approaching. Token ${customer.token} has ${peopleAhead} ahead in ${serviceName}. Please stay near the counters.`,
        customer.token
      );
    }

    // Rule: Counter closed notification
    if (action.type === 'closeCounter' && closedCounterName) {
      const counterClosedMsg =
        newEta === null
          ? `${closedCounterName} closed. Waiting for an available counter.`
          : `${closedCounterName} closed. Estimated wait for token ${customer.token} is now ${newEta} minutes.`;
      addNotification('counter_closed', counterClosedMsg, customer.token);
      customer.lastNotifiedEta = newEta;
    } else {
      // Rule: Significant ETA change
      const baseEta = customer.lastNotifiedEta ?? customer.estimateAtJoin;
      if (baseEta !== null && newEta !== null) {
        if (Math.abs(newEta - baseEta) >= org.settings.significantEtaChangeMinutes) {
          addNotification(
            'eta_changed',
            `Estimated wait for token ${customer.token} changed from ${baseEta} to ${newEta} minutes.`,
            customer.token
          );
          customer.lastNotifiedEta = newEta;
        }
      } else if (baseEta !== null && newEta === null) {
        addNotification(
          'eta_changed',
          `Waiting for an available counter.`,
          customer.token
        );
        customer.lastNotifiedEta = newEta;
      } else if (baseEta === null && newEta !== null) {
        addNotification(
          'eta_changed',
          `Estimated wait for token ${customer.token} is now ${newEta} minutes.`,
          customer.token
        );
        customer.lastNotifiedEta = newEta;
      }
    }
  }

  // Update PulseSnapshots and check for critical level alert on mutating actions
  if (action.type !== 'tick') {
    for (const service of org.services) {
      const history = org.pulseHistory[service.id] || [];
      const prevLevel = history.length > 0 ? history[history.length - 1].level : 'calm';

      const pulse = getPulse(org, service.id, now);
      const snapshot: PulseSnapshot = {
        at: now,
        waiting: pulse.waiting,
        newArrivalEta: pulse.newArrivalEta,
        compatibleOpen: pulse.compatibleOpen,
        level: pulse.level,
      };

      if (!org.pulseHistory[service.id]) {
        org.pulseHistory[service.id] = [];
      }
      org.pulseHistory[service.id].push(snapshot);
      if (org.pulseHistory[service.id].length > 10) {
        org.pulseHistory[service.id] = org.pulseHistory[service.id].slice(-10);
      }

      if (prevLevel !== 'critical' && pulse.level === 'critical') {
        addNotification(
          'pulse_critical',
          `${service.name} queue is Critical with ${pulse.waiting} waiting.`,
          null
        );
      }
    }
  }

  // Update peakWaiting
  const currentTotalWaiting = org.customers.filter((c) => c.status === 'waiting').length;
  org.stats.peakWaiting = Math.max(org.stats.peakWaiting, currentTotalWaiting);

  // Trim arrays
  if (org.notifications.length > 500) {
    org.notifications = org.notifications.slice(0, 500);
  }
  if (org.activity.length > 200) {
    org.activity = org.activity.slice(0, 200);
  }
  if (org.records.length > 200) {
    org.records = org.records.slice(-200);
  }
  if (org.counterLog.length > 200) {
    org.counterLog = org.counterLog.slice(-200);
  }

  // Trim terminal tokens older than 24 hours
  const cutoff24h = now - 24 * 3600 * 1000;
  org.customers = org.customers.filter((c) => {
    if (['completed', 'cancelled', 'expired'].includes(c.status)) {
      const termTime = c.completedAt ?? c.missedAt ?? c.joinedAt;
      return termTime >= cutoff24h;
    }
    return true;
  });

  return {
    ok: true,
    state: nextState,
    token: generatedToken,
    cancelSecret: generatedSecret,
  };
}
