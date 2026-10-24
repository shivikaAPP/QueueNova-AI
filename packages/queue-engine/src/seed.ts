import { AppState, OrgState, ServiceRecord, Customer, AppointmentSlot, Settings } from './types.js';

export const defaultSettings: Settings = {
  calmMax: 5,
  busyMax: 12,
  approachingAhead: 2,
  significantEtaChangeMinutes: 5,
  graceMinutes: 5,
  maxMisses: 2,
  missedPolicy: 'requeue_last_in_tier',
  appointmentEarlyMinutes: 10,
  appointmentLateMinutes: 15,
  confidenceMaxCv: 0.35,
  confidenceWindowMinutes: 10,
  maxWaiting: 200,
};

export function createSeedRecords(
  serviceId: string,
  counterId: string,
  defaultMinutes: number,
  now: number,
  random: () => number
): ServiceRecord[] {
  const records: ServiceRecord[] = [];
  for (let i = 0; i < 15; i++) {
    const variation = (random() * 2 - 1) * 0.8;
    const duration = Math.round((defaultMinutes + variation) * 10) / 10;
    const ended = now - (15 - i) * 15 * 60000;
    const started = ended - duration * 60000;
    const wait = Math.max(1, Math.round(duration * 1.5 * 10) / 10);
    records.push({
      tokenId: `QN-SEED-${serviceId}-${i + 1}`,
      serviceId,
      counterId,
      startedAt: started,
      endedAt: ended,
      durationMinutes: duration,
      estimateAtJoin: wait,
      actualWaitMinutes: wait,
      simulated: true,
    });
  }
  return records;
}

export function createSlots(serviceId: string, now: number): AppointmentSlot[] {
  const offsets = [-10, 0, 10, 25, 45];
  return offsets.map((mins, idx) => ({
    id: `slot-${serviceId}-${idx + 1}`,
    serviceId,
    startsAt: now + mins * 60000,
    capacity: 2,
  }));
}

export function resetDemo(now: number, random: () => number = Math.random): AppState {
  const hospitalRecords = [
    ...createSeedRecords('opd', 'c1', 5, now, random),
    ...createSeedRecords('pharmacy', 'c1', 4, now, random),
    ...createSeedRecords('lab', 'c2', 6, now, random),
  ];

  const bankRecords = [
    ...createSeedRecords('cash', 'b-c1', 4, now, random),
    ...createSeedRecords('accounts', 'b-c2', 10, now, random),
  ];

  const hospitalSlots = [
    ...createSlots('opd', now),
    ...createSlots('pharmacy', now),
    ...createSlots('lab', now),
  ];

  const bankSlots = [
    ...createSlots('cash', now),
    ...createSlots('accounts', now),
  ];

  const hospitalServingCustomer: Customer = {
    id: 'cust-101',
    token: 'QN-101',
    cancelSecret: 's101seed',
    name: 'Demo visitor 01',
    serviceId: 'opd',
    joinedAt: now - 15 * 60000,
    queueTime: now - 15 * 60000,
    slotId: null,
    priority: 'none',
    status: 'serving',
    counterId: 'c2',
    calledAt: now - 3 * 60000,
    servingStartedAt: now - 2 * 60000,
    completedAt: null,
    missedAt: null,
    missedCount: 0,
    estimateAtJoin: 5,
    estimatedWaitMinutes: 0,
    lastNotifiedEta: 5,
    approachingNotified: true,
  };

  const hospitalWaitingCustomers: Customer[] = [
    {
      id: 'cust-102',
      token: 'QN-102',
      cancelSecret: 's102seed',
      name: 'Demo visitor 02',
      serviceId: 'opd',
      joinedAt: now - 12 * 60000,
      queueTime: now - 12 * 60000,
      slotId: null,
      priority: 'none',
      status: 'waiting',
      counterId: null,
      calledAt: null,
      servingStartedAt: null,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: 5,
      estimatedWaitMinutes: 3,
      lastNotifiedEta: 5,
      approachingNotified: false,
    },
    {
      id: 'cust-103',
      token: 'QN-103',
      cancelSecret: 's103seed',
      name: 'Demo visitor 03',
      serviceId: 'opd',
      joinedAt: now - 10 * 60000,
      queueTime: now - 10 * 60000,
      slotId: null,
      priority: 'none',
      status: 'waiting',
      counterId: null,
      calledAt: null,
      servingStartedAt: null,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: 10,
      estimatedWaitMinutes: 8,
      lastNotifiedEta: 10,
      approachingNotified: false,
    },
    {
      id: 'cust-104',
      token: 'QN-104',
      cancelSecret: 's104seed',
      name: 'Demo visitor 04',
      serviceId: 'opd',
      joinedAt: now - 8 * 60000,
      queueTime: now - 8 * 60000,
      slotId: null,
      priority: 'none',
      status: 'waiting',
      counterId: null,
      calledAt: null,
      servingStartedAt: null,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: 15,
      estimatedWaitMinutes: 13,
      lastNotifiedEta: 15,
      approachingNotified: false,
    },
    {
      id: 'cust-105',
      token: 'QN-105',
      cancelSecret: 's105seed',
      name: 'Demo visitor 05',
      serviceId: 'opd',
      joinedAt: now - 6 * 60000,
      queueTime: now - 6 * 60000,
      slotId: null,
      priority: 'none',
      status: 'waiting',
      counterId: null,
      calledAt: null,
      servingStartedAt: null,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: 20,
      estimatedWaitMinutes: 18,
      lastNotifiedEta: 20,
      approachingNotified: false,
    },
    {
      id: 'cust-106',
      token: 'QN-106',
      cancelSecret: 's106seed',
      name: 'Demo visitor 06',
      serviceId: 'opd',
      joinedAt: now - 4 * 60000,
      queueTime: now - 4 * 60000,
      slotId: null,
      priority: 'none',
      status: 'waiting',
      counterId: null,
      calledAt: null,
      servingStartedAt: null,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: 25,
      estimatedWaitMinutes: 23,
      lastNotifiedEta: 25,
      approachingNotified: false,
    },
    {
      id: 'cust-107',
      token: 'QN-107',
      cancelSecret: 's107seed',
      name: 'Demo visitor 07',
      serviceId: 'opd',
      joinedAt: now - 2 * 60000,
      queueTime: now - 2 * 60000,
      slotId: null,
      priority: 'none',
      status: 'waiting',
      counterId: null,
      calledAt: null,
      servingStartedAt: null,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: 30,
      estimatedWaitMinutes: 28,
      lastNotifiedEta: 30,
      approachingNotified: false,
    },
    {
      id: 'cust-108',
      token: 'QN-108',
      cancelSecret: 's108seed',
      name: 'Demo visitor 08',
      serviceId: 'pharmacy',
      joinedAt: now - 5 * 60000,
      queueTime: now - 5 * 60000,
      slotId: null,
      priority: 'none',
      status: 'waiting',
      counterId: null,
      calledAt: null,
      servingStartedAt: null,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: 4,
      estimatedWaitMinutes: 4,
      lastNotifiedEta: 4,
      approachingNotified: false,
    },
    {
      id: 'cust-109',
      token: 'QN-109',
      cancelSecret: 's109seed',
      name: 'Demo visitor 09',
      serviceId: 'lab',
      joinedAt: now - 3 * 60000,
      queueTime: now - 3 * 60000,
      slotId: null,
      priority: 'none',
      status: 'waiting',
      counterId: null,
      calledAt: null,
      servingStartedAt: null,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: 6,
      estimatedWaitMinutes: 4,
      lastNotifiedEta: 6,
      approachingNotified: false,
    },
  ];

  const bankWaitingCustomers: Customer[] = [
    {
      id: 'cust-b-1',
      token: 'QN-110',
      cancelSecret: 'sb110seed',
      name: 'Demo visitor 10',
      serviceId: 'cash',
      joinedAt: now - 5 * 60000,
      queueTime: now - 5 * 60000,
      slotId: null,
      priority: 'none',
      status: 'waiting',
      counterId: null,
      calledAt: null,
      servingStartedAt: null,
      completedAt: null,
      missedAt: null,
      missedCount: 0,
      estimateAtJoin: 4,
      estimatedWaitMinutes: 0,
      lastNotifiedEta: 4,
      approachingNotified: false,
    },
  ];

  const hospitalOrg: OrgState = {
    id: 'demo-hospital',
    name: 'Demo City Hospital',
    services: [
      { id: 'opd', name: 'OPD registration', defaultMinutes: 5 },
      { id: 'pharmacy', name: 'Pharmacy', defaultMinutes: 4 },
      { id: 'lab', name: 'Lab sample', defaultMinutes: 6 },
    ],
    slots: hospitalSlots,
    counters: [
      { id: 'c1', name: 'Counter 1', serviceIds: ['opd', 'pharmacy'], status: 'available', currentTokenId: null },
      { id: 'c2', name: 'Counter 2', serviceIds: ['opd', 'lab'], status: 'serving', currentTokenId: 'cust-101' },
      { id: 'c3', name: 'Counter 3', serviceIds: ['pharmacy'], status: 'closed', currentTokenId: null },
      { id: 'c4', name: 'Counter 4', serviceIds: ['opd'], status: 'closed', currentTokenId: null },
    ],
    customers: [hospitalServingCustomer, ...hospitalWaitingCustomers],
    records: hospitalRecords,
    counterLog: [
      { counterId: 'c1', status: 'available', at: now - 30 * 60000 },
      { counterId: 'c2', status: 'serving', at: now - 2 * 60000 },
      { counterId: 'c3', status: 'closed', at: now - 60 * 60000 },
      { counterId: 'c4', status: 'closed', at: now - 60 * 60000 },
    ],
    notifications: [
      {
        id: 'seed-notif-1',
        tokenId: 'QN-101',
        kind: 'called',
        message: 'Token QN-101 is called. Please go to Counter 2.',
        createdAt: now - 3 * 60000,
        read: true,
      },
    ],
    activity: [
      { id: 'act-1', at: now - 3 * 60000, text: 'Token QN-101 called to Counter 2.' },
      { id: 'act-2', at: now - 2 * 60000, text: 'Counter 2 started service for QN-101.' },
    ],
    pulseHistory: {
      opd: [
        { at: now - 15 * 60000, waiting: 3, newArrivalEta: 10, compatibleOpen: 2, level: 'calm' },
        { at: now - 10 * 60000, waiting: 4, newArrivalEta: 15, compatibleOpen: 2, level: 'calm' },
        { at: now - 5 * 60000, waiting: 6, newArrivalEta: 28, compatibleOpen: 2, level: 'busy' },
      ],
      pharmacy: [
        { at: now - 5 * 60000, waiting: 1, newArrivalEta: 4, compatibleOpen: 1, level: 'calm' },
      ],
      lab: [
        { at: now - 5 * 60000, waiting: 1, newArrivalEta: 4, compatibleOpen: 1, level: 'calm' },
      ],
    },
    stats: {
      registrations: hospitalRecords.length + 9,
      completed: hospitalRecords.length,
      cancelled: 0,
      expired: 0,
      peakWaiting: 6,
    },
    settings: { ...defaultSettings },
  };

  const bankOrg: OrgState = {
    id: 'demo-bank',
    name: 'Demo Savings Bank',
    services: [
      { id: 'cash', name: 'Cash services', defaultMinutes: 4 },
      { id: 'accounts', name: 'Account opening', defaultMinutes: 10 },
    ],
    slots: bankSlots,
    counters: [
      { id: 'b-c1', name: 'Counter 1', serviceIds: ['cash'], status: 'available', currentTokenId: null },
      { id: 'b-c2', name: 'Counter 2', serviceIds: ['cash', 'accounts'], status: 'available', currentTokenId: null },
      { id: 'b-c3', name: 'Counter 3', serviceIds: ['accounts'], status: 'closed', currentTokenId: null },
    ],
    customers: bankWaitingCustomers,
    records: bankRecords,
    counterLog: [
      { counterId: 'b-c1', status: 'available', at: now - 30 * 60000 },
      { counterId: 'b-c2', status: 'available', at: now - 30 * 60000 },
      { counterId: 'b-c3', status: 'closed', at: now - 60 * 60000 },
    ],
    notifications: [],
    activity: [],
    pulseHistory: {
      cash: [
        { at: now - 5 * 60000, waiting: 1, newArrivalEta: 0, compatibleOpen: 2, level: 'calm' },
      ],
      accounts: [
        { at: now - 5 * 60000, waiting: 0, newArrivalEta: 0, compatibleOpen: 1, level: 'calm' },
      ],
    },
    stats: {
      registrations: bankRecords.length + 1,
      completed: bankRecords.length,
      cancelled: 0,
      expired: 0,
      peakWaiting: 1,
    },
    settings: { ...defaultSettings },
  };

  return {
    schemaVersion: 1,
    nextSeq: 111,
    orgs: {
      'demo-hospital': hospitalOrg,
      'demo-bank': bankOrg,
    },
  };
}
