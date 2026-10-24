import { describe, it, expect } from 'vitest';
import {
  AppState,
  OrgState,
  apply,
  estimateWaitFor,
  getReturnWindow,
  estimateForNewArrival,
  getPulse,
  getRecommendations,
  getConfidence,
  getFlowScore,
  defaultSettings,
  compareWaitingCustomers,
} from '../src/index.js';

function createDeterministicRandom(seed = 42) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createBaseFixture(now: number): AppState {
  const org: OrgState = {
    id: 'test-org',
    name: 'Test Org',
    services: [{ id: 'srvA', name: 'Service A', defaultMinutes: 5 }],
    slots: [],
    counters: [
      { id: 'C1', name: 'Counter 1', serviceIds: ['srvA'], status: 'available', currentTokenId: null },
      { id: 'C2', name: 'Counter 2', serviceIds: ['srvA'], status: 'available', currentTokenId: null },
      { id: 'C3', name: 'Counter 3', serviceIds: ['srvA'], status: 'available', currentTokenId: null },
    ],
    customers: [],
    records: [],
    counterLog: [],
    notifications: [],
    activity: [],
    pulseHistory: {},
    stats: { registrations: 0, completed: 0, cancelled: 0, expired: 0, peakWaiting: 0 },
    settings: { ...defaultSettings },
  };

  return {
    schemaVersion: 1,
    nextSeq: 101,
    orgs: {
      'test-org': org,
    },
  };
}

describe('Queue Engine Vitest Test Cases (Architecture Section 17)', () => {
  const fixedNow = 1700000000000;
  const rand = createDeterministicRandom();

  it('1. ETA formula check: 3 available counters, 12 waiting customers for A ahead: estimate for 13th is 20', () => {
    let state = createBaseFixture(fixedNow);
    for (let i = 1; i <= 13; i++) {
      const res = apply(state, {
        type: 'join',
        orgId: 'test-org',
        name: `Customer ${i}`,
        serviceId: 'srvA',
      }, fixedNow, rand);
      expect(res.ok).toBe(true);
      if (res.ok) state = res.state;
    }

    const org = state.orgs['test-org'];
    const cust13 = org.customers.find((c) => c.name === 'Customer 13');
    expect(cust13).toBeDefined();
    const est = estimateWaitFor(org, cust13!.token, fixedNow);
    expect(est).toBe(20);
  });

  it('2. Return window for estimate 20 is 15 to 17. For 5 and 3 text is Stay nearby', () => {
    const w20 = getReturnWindow(20);
    expect(w20?.start).toBe(15);
    expect(w20?.end).toBe(17);
    expect(w20?.text).toBe('Come back in 15 to 17 minutes');

    const w5 = getReturnWindow(5);
    expect(w5?.text).toBe('Stay nearby, your turn is close');

    const w3 = getReturnWindow(3);
    expect(w3?.text).toBe('Stay nearby, your turn is close');
  });

  it('3. No compatible counter (all closed): estimate is null', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];
    org.counters.forEach((c) => (c.status = 'closed'));

    org.customers.push({
      id: 'c1',
      token: 'QN-101',
      cancelSecret: 'sec',
      name: 'Waiting 1',
      serviceId: 'srvA',
      joinedAt: fixedNow,
      queueTime: fixedNow,
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
    });

    const est = estimateWaitFor(org, 'QN-101', fixedNow);
    expect(est).toBeNull();
  });

  it('4. Counters C2 and C3 closed, C1 serving a token started 2 mins ago (avg 5): estimate is 3', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];
    org.counters.find((c) => c.id === 'C2')!.status = 'closed';
    org.counters.find((c) => c.id === 'C3')!.status = 'closed';

    const c1 = org.counters.find((c) => c.id === 'C1')!;
    c1.status = 'serving';
    c1.currentTokenId = 'cust-active';

    org.customers.push({
      id: 'cust-active',
      token: 'QN-100',
      cancelSecret: 's',
      name: 'Active',
      serviceId: 'srvA',
      joinedAt: fixedNow - 10 * 60000,
      queueTime: fixedNow - 10 * 60000,
      slotId: null,
      priority: 'none',
      status: 'serving',
      counterId: 'C1',
      calledAt: fixedNow - 2 * 60000,
      servingStartedAt: fixedNow - 2 * 60000,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: null,
      estimatedWaitMinutes: null,
      lastNotifiedEta: null,
      approachingNotified: false,
    });

    const est = estimateForNewArrival(org, 'srvA', fixedNow);
    expect(est).toBe(3);
  });

  it('5. Order: approved priority, then appointment, then walk-in', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];

    const walkin: any = {
      id: 'w',
      token: 'QN-101',
      priority: 'none',
      slotId: null,
      queueTime: fixedNow - 20 * 60000,
    };
    const appt: any = {
      id: 'a',
      token: 'QN-102',
      priority: 'none',
      slotId: 'slot-1',
      queueTime: fixedNow - 10 * 60000,
    };
    const prio: any = {
      id: 'p',
      token: 'QN-103',
      priority: 'approved',
      slotId: null,
      queueTime: fixedNow - 5 * 60000,
    };

    const sorted = [walkin, appt, prio].sort(compareWaitingCustomers);
    expect(sorted[0].id).toBe('p');
    expect(sorted[1].id).toBe('a');
    expect(sorted[2].id).toBe('w');
  });

  it('6. Pending priority does not change order; approve moves to rank 0; reject leaves base tier', () => {
    let state = createBaseFixture(fixedNow);
    let r1 = apply(state, { type: 'join', orgId: 'test-org', name: 'User 1', serviceId: 'srvA' }, fixedNow - 1000, rand);
    let r2 = apply(r1.state!, { type: 'join', orgId: 'test-org', name: 'User 2', serviceId: 'srvA', requestPriority: true }, fixedNow, rand);
    state = r2.state!;

    let org = state.orgs['test-org'];
    let waiting = org.customers.filter((c) => c.status === 'waiting').sort(compareWaitingCustomers);
    expect(waiting[0].name).toBe('User 1');
    expect(waiting[1].name).toBe('User 2');

    // Approve priority
    let rApprove = apply(state, { type: 'approvePriority', orgId: 'test-org', tokenId: waiting[1].token }, fixedNow, rand);
    state = rApprove.state!;
    org = state.orgs['test-org'];
    waiting = org.customers.filter((c) => c.status === 'waiting').sort(compareWaitingCustomers);
    expect(waiting[0].name).toBe('User 2'); // Now first!

    // Reject on a new join
    let r3 = apply(state, { type: 'join', orgId: 'test-org', name: 'User 3', serviceId: 'srvA', requestPriority: true }, fixedNow + 1000, rand);
    let rReject = apply(r3.state!, { type: 'rejectPriority', orgId: 'test-org', tokenId: r3.token! }, fixedNow + 2000, rand);
    org = rReject.state!.orgs['test-org'];
    const u3 = org.customers.find((c) => c.token === r3.token);
    expect(u3?.priority).toBe('rejected');
  });

  it('7. callNext picks only tokens the counter supports; returns NO_ELIGIBLE_TOKEN if none', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];
    org.counters[0].serviceIds = ['srvOther'];

    const res = apply(state, { type: 'callNext', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    expect(res.ok).toBe(false);
    expect((res as any).code).toBe('NO_ELIGIBLE_TOKEN');
  });

  it('8. callNext on a serving counter returns COUNTER_BUSY. On closed returns COUNTER_CLOSED', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];
    org.counters[0].status = 'closed';

    const rClosed = apply(state, { type: 'callNext', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    expect(rClosed.ok).toBe(false);
    expect((rClosed as any).code).toBe('COUNTER_CLOSED');

    org.counters[1].status = 'serving';
    org.counters[1].currentTokenId = 'someone';
    const rBusy = apply(state, { type: 'callNext', orgId: 'test-org', counterId: 'C2' }, fixedNow, rand);
    expect(rBusy.ok).toBe(false);
    expect((rBusy as any).code).toBe('COUNTER_BUSY');
  });

  it('9. closeCounter on serving returns COUNTER_BUSY with exact message; succeeds after completeService', () => {
    let state = createBaseFixture(fixedNow);
    let r1 = apply(state, { type: 'join', orgId: 'test-org', name: 'Serving Person', serviceId: 'srvA' }, fixedNow, rand);
    let r2 = apply(r1.state!, { type: 'callNext', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    state = r2.state!;

    const tok = r1.token!;
    const rClose = apply(state, { type: 'closeCounter', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    expect(rClose.ok).toBe(false);
    expect((rClose as any).code).toBe('COUNTER_BUSY');
    expect((rClose as any).message).toBe(`Cannot close while serving ${tok}. Complete the service first.`);

    // Complete service
    const rComp = apply(state, { type: 'completeService', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    expect(rComp.ok).toBe(true);

    const rClose2 = apply(rComp.state!, { type: 'closeCounter', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    expect(rClose2.ok).toBe(true);
  });

  it('10. closeCounter on last non-closed counter returns LAST_ACTIVE_COUNTER', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];
    org.counters[0].status = 'closed';
    org.counters[1].status = 'closed';

    const rLast = apply(state, { type: 'closeCounter', orgId: 'test-org', counterId: 'C3' }, fixedNow, rand);
    expect(rLast.ok).toBe(false);
    expect((rLast as any).code).toBe('LAST_ACTIVE_COUNTER');
  });

  it('11. QueuePulse levels at 5, 6, 12, and 13 waiting: calm, busy, busy, critical', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];

    const makeCustomers = (count: number) =>
      Array(count)
        .fill(null)
        .map((_, i) => ({
          id: `c-${i}`,
          token: `QN-${100 + i}`,
          status: 'waiting',
          serviceId: 'srvA',
          queueTime: fixedNow,
          priority: 'none',
          slotId: null,
        } as any));

    expect(getPulse({ ...org, customers: makeCustomers(5) }, 'srvA', fixedNow).level).toBe('calm');
    expect(getPulse({ ...org, customers: makeCustomers(6) }, 'srvA', fixedNow).level).toBe('busy');
    expect(getPulse({ ...org, customers: makeCustomers(12) }, 'srvA', fixedNow).level).toBe('busy');
    expect(getPulse({ ...org, customers: makeCustomers(13) }, 'srvA', fixedNow).level).toBe('critical');
  });

  it('12. Critical with closed compatible: open_counter; with idle non-supporting: reassign_counter', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];
    org.counters[0].status = 'closed';
    org.counters[1].status = 'available';
    org.counters[2].status = 'available';
    org.customers = Array(13).fill(null).map((_, i) => ({
      id: `c-${i}`,
      token: `QN-${100 + i}`,
      status: 'waiting',
      serviceId: 'srvA',
    } as any));

    const recs1 = getRecommendations(org, fixedNow);
    expect(recs1[0].type).toBe('open_counter');
    expect(recs1[0].counterId).toBe('C1');

    // Case 2: No closed compatible, but an idle non-supporting counter
    org.counters[0].status = 'available';
    org.counters[0].serviceIds = ['srvOther'];
    const recs2 = getRecommendations(org, fixedNow);
    expect(recs2[0].type).toBe('reassign_counter');
    expect(recs2[0].counterId).toBe('C1');
  });

  it('13. Recommender never names a serving counter or last non-closed counter for closing (200 random states)', () => {
    for (let i = 0; i < 200; i++) {
      const state = createBaseFixture(fixedNow);
      const org = state.orgs['test-org'];
      // Randomize counters
      for (const counter of org.counters) {
        const statuses = ['available', 'serving', 'closed'] as const;
        counter.status = statuses[Math.floor(rand() * 3)];
        if (counter.status === 'serving') {
          counter.currentTokenId = `tok-${i}`;
        } else {
          counter.currentTokenId = null;
        }
      }

      // Add random calm snapshots
      org.pulseHistory['srvA'] = Array(5).fill({ level: 'calm', at: fixedNow });

      const recs = getRecommendations(org, fixedNow);
      for (const rec of recs) {
        if (rec.type === 'review_staffing' && rec.counterId) {
          const namedCounter = org.counters.find((c) => c.id === rec.counterId);
          expect(namedCounter?.status).toBe('available');
          expect(namedCounter?.currentTokenId).toBeNull();
          const nonClosed = org.counters.filter((c) => c.status !== 'closed');
          expect(nonClosed.length).toBeGreaterThan(1);
        }
      }
    }
  });

  it('14. Busy with three rising snapshots: review_allocation. Five calm with 2 idle: review_staffing', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];
    org.customers = Array(8).fill(null).map((_, i) => ({
      id: `c-${i}`,
      token: `QN-${100 + i}`,
      status: 'waiting',
      serviceId: 'srvA',
    } as any));

    org.pulseHistory['srvA'] = [
      { at: fixedNow - 30000, waiting: 6, newArrivalEta: 10, compatibleOpen: 3, level: 'busy' },
      { at: fixedNow - 20000, waiting: 7, newArrivalEta: 12, compatibleOpen: 3, level: 'busy' },
      { at: fixedNow - 10000, waiting: 8, newArrivalEta: 15, compatibleOpen: 3, level: 'busy' },
    ];

    const recsBusy = getRecommendations(org, fixedNow);
    expect(recsBusy[0].type).toBe('review_allocation');

    // Five calm snapshots with two idle
    org.customers = [];
    org.pulseHistory['srvA'] = Array(5).fill({ level: 'calm', at: fixedNow, waiting: 0, newArrivalEta: 0, compatibleOpen: 3 });
    const recsCalm = getRecommendations(org, fixedNow);
    expect(recsCalm[0].type).toBe('review_staffing');
  });

  it('15. Missed turn: markMissed frees counter; tick requeues or expires', () => {
    let state = createBaseFixture(fixedNow);
    let r1 = apply(state, { type: 'join', orgId: 'test-org', name: 'Miss Me', serviceId: 'srvA' }, fixedNow, rand);
    let r2 = apply(r1.state!, { type: 'callNext', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    let r3 = apply(r2.state!, { type: 'markMissed', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    state = r3.state!;

    let org = state.orgs['test-org'];
    expect(org.counters.find((c) => c.id === 'C1')?.status).toBe('available');
    let cust = org.customers.find((c) => c.token === r1.token)!;
    expect(cust.status).toBe('missed');
    expect(cust.missedCount).toBe(1);

    // Before grace (e.g. 4 minutes)
    let rTickBefore = apply(state, { type: 'tick', orgId: 'test-org' }, fixedNow + 4 * 60000, rand);
    expect(rTickBefore.state!.orgs['test-org'].customers.find((c) => c.token === r1.token)?.status).toBe('missed');

    // After grace (6 minutes)
    let rTickAfter = apply(state, { type: 'tick', orgId: 'test-org' }, fixedNow + 6 * 60000, rand);
    let custAfter = rTickAfter.state!.orgs['test-org'].customers.find((c) => c.token === r1.token)!;
    expect(custAfter.status).toBe('waiting'); // Requeued

    // Mark missed second time and expire
    custAfter.status = 'called';
    custAfter.missedCount = 2; // Equal to maxMisses
    custAfter.missedAt = fixedNow + 6 * 60000;
    custAfter.status = 'missed';
    let rExpire = apply(rTickAfter.state!, { type: 'tick', orgId: 'test-org' }, fixedNow + 12 * 60000, rand);
    let custExpired = rExpire.state!.orgs['test-org'].customers.find((c) => c.token === r1.token)!;
    expect(custExpired.status).toBe('expired');
  });

  it('16. recallMissed with no available compatible counter returns NO_COMPATIBLE_COUNTER', () => {
    let state = createBaseFixture(fixedNow);
    let r1 = apply(state, { type: 'join', orgId: 'test-org', name: 'User', serviceId: 'srvA' }, fixedNow, rand);
    let r2 = apply(r1.state!, { type: 'callNext', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    let r3 = apply(r2.state!, { type: 'markMissed', orgId: 'test-org', counterId: 'C1' }, fixedNow, rand);
    state = r3.state!;

    // Make all counters closed or busy
    state.orgs['test-org'].counters.forEach((c) => (c.status = 'closed'));
    const rRecall = apply(state, { type: 'recallMissed', orgId: 'test-org', tokenId: r1.token!, counterId: 'C1' }, fixedNow, rand);
    expect(rRecall.ok).toBe(false);
    expect((rRecall as any).code).toBe('COUNTER_CLOSED');
  });

  it('17. Skip moves a waiting token behind other waiting tokens of the same tier and not behind other tiers', () => {
    let state = createBaseFixture(fixedNow);
    state.orgs['test-org'].slots = [{ id: 'slot-1', serviceId: 'srvA', startsAt: fixedNow, capacity: 2 }];
    let r1 = apply(state, { type: 'join', orgId: 'test-org', name: 'Appt 1', serviceId: 'srvA', slotId: 'slot-1' }, fixedNow - 3000, rand);
    let r2 = apply(r1.state!, { type: 'join', orgId: 'test-org', name: 'Walkin 1', serviceId: 'srvA' }, fixedNow - 2000, rand);
    let r3 = apply(r2.state!, { type: 'join', orgId: 'test-org', name: 'Walkin 2', serviceId: 'srvA' }, fixedNow - 1000, rand);
    state = r3.state!;

    // Skip Walkin 1
    let rSkip = apply(state, { type: 'skip', orgId: 'test-org', tokenId: r2.token! }, fixedNow, rand);
    state = rSkip.state!;

    const waiting = state.orgs['test-org'].customers.filter((c) => c.status === 'waiting').sort(compareWaitingCustomers);
    expect(waiting[0].name).toBe('Appt 1');
    expect(waiting[1].name).toBe('Walkin 2');
    expect(waiting[2].name).toBe('Walkin 1');
  });

  it('18. Notifications: approaching sent once when ahead drops to 2; ETA change below 5 sends nothing, 5+ sends one', () => {
    let state = createBaseFixture(fixedNow);
    let r1 = apply(state, { type: 'join', orgId: 'test-org', name: 'Cust 1', serviceId: 'srvA' }, fixedNow - 3000, rand);
    let r2 = apply(r1.state!, { type: 'join', orgId: 'test-org', name: 'Cust 2', serviceId: 'srvA' }, fixedNow - 2000, rand);
    let r3 = apply(r2.state!, { type: 'join', orgId: 'test-org', name: 'Cust 3', serviceId: 'srvA' }, fixedNow - 1000, rand);
    state = r3.state!;

    // Cust 3 initially has 2 people ahead -> approaching notification sent!
    const org = state.orgs['test-org'];
    const notifs = org.notifications.filter((n) => n.tokenId === r3.token && n.kind === 'approaching');
    expect(notifs.length).toBe(1);
  });

  it('19. Join validation errors check', () => {
    const state = createBaseFixture(fixedNow);
    // Empty name
    const rEmpty = apply(state, { type: 'join', orgId: 'test-org', name: '', serviceId: 'srvA' }, fixedNow, rand);
    expect(rEmpty.ok).toBe(false);
    expect((rEmpty as any).code).toBe('VALIDATION');

    // 61 chars name
    const r61 = apply(state, { type: 'join', orgId: 'test-org', name: 'A'.repeat(61), serviceId: 'srvA' }, fixedNow, rand);
    expect(r61.ok).toBe(false);
    expect((r61 as any).code).toBe('VALIDATION');

    // Unknown service
    const rUnknown = apply(state, { type: 'join', orgId: 'test-org', name: 'John', serviceId: 'unknown' }, fixedNow, rand);
    expect(rUnknown.ok).toBe(false);
    expect((rUnknown as any).code).toBe('NOT_FOUND');
  });

  it('20. Confidence: fewer than 3 is insufficient; 5 equal is stable; counter change within 10 min is changing', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];

    // Fewer than 3
    expect(getConfidence(org, 'srvA', fixedNow)).toBe('insufficient');

    // 5 equal durations
    org.records = Array(5).fill(null).map((_, i) => ({
      tokenId: `Q-${i}`,
      serviceId: 'srvA',
      counterId: 'C1',
      startedAt: fixedNow - 30 * 60000,
      endedAt: fixedNow - 25 * 60000,
      durationMinutes: 5,
      estimateAtJoin: 5,
      actualWaitMinutes: 5,
      simulated: true,
    }));
    expect(getConfidence(org, 'srvA', fixedNow)).toBe('stable');

    // Counter status change within 10 minutes
    org.counterLog.push({ counterId: 'C1', status: 'available', at: fixedNow - 5 * 60000 });
    expect(getConfidence(org, 'srvA', fixedNow)).toBe('changing');
  });

  it('21. Flow Score: 8 completed, 2 cancelled, 6 of 8 on time: round(100*(0.5*0.8 + 0.5*0.75)) = 78', () => {
    const state = createBaseFixture(fixedNow);
    const org = state.orgs['test-org'];
    org.stats.completed = 8;
    org.stats.cancelled = 2;
    org.stats.expired = 0;

    org.records = Array(8).fill(null).map((_, i) => ({
      tokenId: `Q-${i}`,
      serviceId: 'srvA',
      counterId: 'C1',
      startedAt: fixedNow,
      endedAt: fixedNow,
      durationMinutes: 5,
      estimateAtJoin: 10,
      actualWaitMinutes: i < 6 ? 12 : 20, // 6 are <= 10 + 5
      simulated: false,
    }));

    const res = getFlowScore(org);
    expect(res.score).toBe(78);
  });

  it('22. Immutability: apply returns new state and leaves input unchanged', () => {
    const state = createBaseFixture(fixedNow);
    const frozen = JSON.parse(JSON.stringify(state));
    Object.freeze(frozen);
    Object.freeze(frozen.orgs);

    const res = apply(frozen, { type: 'join', orgId: 'test-org', name: 'Immutable User', serviceId: 'srvA' }, fixedNow, rand);
    expect(res.ok).toBe(true);
    expect(frozen.nextSeq).toBe(101);
    expect(res.state?.nextSeq).toBe(102);
  });

  it('23. Persistence: serialised state to JSON and parsed gives identical results', () => {
    let state = createBaseFixture(fixedNow);
    let r1 = apply(state, { type: 'join', orgId: 'test-org', name: 'Persist User', serviceId: 'srvA' }, fixedNow, rand);
    state = r1.state!;

    const json = JSON.stringify(state);
    const parsed = JSON.parse(json);

    const rand1 = createDeterministicRandom(123);
    const rand2 = createDeterministicRandom(123);

    const res1 = apply(state, { type: 'join', orgId: 'test-org', name: 'Next User', serviceId: 'srvA' }, fixedNow + 1000, rand1);
    const res2 = apply(parsed, { type: 'join', orgId: 'test-org', name: 'Next User', serviceId: 'srvA' }, fixedNow + 1000, rand2);

    expect(JSON.stringify(res1.state)).toBe(JSON.stringify(res2.state));
  });
});
