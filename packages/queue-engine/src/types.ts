export type TokenStatus = 'waiting' | 'called' | 'serving' | 'completed' | 'missed' | 'cancelled' | 'expired';
export type Tier = 'accessibility' | 'appointment' | 'walkin';
export type PriorityState = 'none' | 'pending' | 'approved' | 'rejected';
export type CounterStatus = 'available' | 'serving' | 'closed';
export type PulseLevel = 'calm' | 'busy' | 'critical';

export interface Service {
  id: string;
  name: string;
  defaultMinutes: number;
}

export interface AppointmentSlot {
  id: string;
  serviceId: string;
  startsAt: number;
  capacity: number;
}

export interface Customer {
  id: string;
  token: string;
  cancelSecret: string;
  name: string;
  serviceId: string;
  joinedAt: number;
  queueTime: number;
  slotId: string | null;
  priority: PriorityState;
  status: TokenStatus;
  counterId: string | null;
  calledAt: number | null;
  servingStartedAt: number | null;
  completedAt: number | null;
  missedAt: number | null;
  missedCount: number;
  estimateAtJoin: number | null;
  estimatedWaitMinutes: number | null;
  lastNotifiedEta: number | null;
  approachingNotified: boolean;
}

export interface Counter {
  id: string;
  name: string;
  serviceIds: string[];
  status: CounterStatus;
  currentTokenId: string | null;
}

export interface ServiceRecord {
  tokenId: string;
  serviceId: string;
  counterId: string;
  startedAt: number;
  endedAt: number;
  durationMinutes: number;
  estimateAtJoin: number | null;
  actualWaitMinutes: number;
  simulated: boolean;
}

export interface CounterLogEntry {
  counterId: string;
  status: CounterStatus;
  at: number;
}

export interface Notification {
  id: string;
  tokenId: string | null;
  kind: 'approaching' | 'eta_changed' | 'called' | 'counter_closed' | 'completed' | 'missed'
      | 'pulse_critical' | 'grace_expired' | 'recommendation';
  message: string;
  createdAt: number;
  read: boolean;
}

export interface ActivityEntry {
  id: string;
  at: number;
  text: string;
}

export interface PulseSnapshot {
  at: number;
  waiting: number;
  newArrivalEta: number | null;
  compatibleOpen: number;
  level: PulseLevel;
}

export interface Settings {
  calmMax: number;
  busyMax: number;
  approachingAhead: number;
  significantEtaChangeMinutes: number;
  graceMinutes: number;
  maxMisses: number;
  missedPolicy: 'requeue_last_in_tier' | 'expire';
  appointmentEarlyMinutes: number;
  appointmentLateMinutes: number;
  confidenceMaxCv: number;
  confidenceWindowMinutes: number;
  maxWaiting: number;
}

export interface OrgState {
  id: string;
  name: string;
  services: Service[];
  slots: AppointmentSlot[];
  counters: Counter[];
  customers: Customer[];
  records: ServiceRecord[];
  counterLog: CounterLogEntry[];
  notifications: Notification[];
  activity: ActivityEntry[];
  pulseHistory: Record<string, PulseSnapshot[]>;
  stats: {
    registrations: number;
    completed: number;
    cancelled: number;
    expired: number;
    peakWaiting: number;
  };
  settings: Settings;
}

export interface AppState {
  schemaVersion: 1;
  nextSeq: number;
  orgs: Record<string, OrgState>;
}

export type Action =
  | { type: 'join'; orgId: string; name: string; serviceId: string; slotId?: string; requestPriority?: boolean }
  | { type: 'callNext'; orgId: string; counterId: string }
  | { type: 'startService'; orgId: string; counterId: string }
  | { type: 'completeService'; orgId: string; counterId: string }
  | { type: 'markMissed'; orgId: string; counterId: string }
  | { type: 'recallMissed'; orgId: string; tokenId: string; counterId: string }
  | { type: 'returnMissedToQueue'; orgId: string; tokenId: string }
  | { type: 'skip'; orgId: string; tokenId: string }
  | { type: 'cancel'; orgId: string; tokenId: string; cancelSecret?: string; byStaff?: boolean }
  | { type: 'approvePriority'; orgId: string; tokenId: string }
  | { type: 'rejectPriority'; orgId: string; tokenId: string }
  | { type: 'openCounter'; orgId: string; counterId: string }
  | { type: 'closeCounter'; orgId: string; counterId: string }
  | { type: 'addCounter'; orgId: string; name: string; serviceIds: string[] }
  | { type: 'setCounterServices'; orgId: string; counterId: string; serviceIds: string[] }
  | { type: 'updateSettings'; orgId: string; patch: Partial<Settings> }
  | { type: 'tick'; orgId: string };

export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'COUNTER_CLOSED'
  | 'COUNTER_BUSY'
  | 'LAST_ACTIVE_COUNTER'
  | 'NO_ELIGIBLE_TOKEN'
  | 'NO_COMPATIBLE_COUNTER'
  | 'SLOT_FULL'
  | 'SLOT_OUT_OF_WINDOW'
  | 'QUEUE_FULL'
  | 'FORBIDDEN';

export type Result =
  | { ok: true; state: AppState; token?: string; cancelSecret?: string }
  | { ok: false; code: ErrorCode; message: string };

export type RecommendationType =
  | 'open_counter'
  | 'reassign_counter'
  | 'add_counter'
  | 'review_allocation'
  | 'review_staffing';

export interface Recommendation {
  serviceId: string;
  type: RecommendationType;
  counterId?: string;
  reason: string;
}
