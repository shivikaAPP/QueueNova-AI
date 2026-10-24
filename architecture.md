# QueueNova: architecture.md

Audience: the backend agent (Claude Opus 4.6) first, and the frontend agent for anything that touches data. This file is the single source of truth for rules, data shapes and numbers. If design.md and this file disagree about logic, this file wins. If they disagree about visuals or copy, design.md wins.

## 1. Scope and phases

- Phase 1: browser only. Engine runs in the browser, state in localStorage, tabs sync with `BroadcastChannel`.
- Phase 2: API and Postgres. Same engine runs on the server. Browser becomes a client of the API.
- Out of scope: real SMS or email, payments, user accounts for customers, a trained model, multi-region hosting.
- Nothing in the product may claim to use machine learning. Recommendations are fixed rules.

## 2. System overview

```
Phase 1
  Browser tab A  <--BroadcastChannel-->  Browser tab B
     |                                      |
  QueueStore (localStorage adapter)      QueueStore
     |                                      |
  queue-engine (pure TS)                 queue-engine

Phase 2
  Browser  --HTTPS-->  api.YOUR-DOMAIN (Fastify)  -->  Postgres (org_state JSONB, versioned)
     ^                      |
     +-------- SSE ---------+        queue-engine (same package, runs on the server)
  Static site: YOUR-DOMAIN (Netlify, prerendered HTML + lazy JS chunks)
```

Rule: only the engine changes queue state. UI code and API handlers call `apply()` and render what it returns.

## 3. Repo layout

```
queuenova/
  package.json                 (npm workspaces)
  design.md  techstack.md  architecture.md
  scripts/qa.sh
  packages/queue-engine/
    src/types.ts  src/apply.ts  src/order.ts  src/eta.ts  src/pulse.ts
    src/recommend.ts  src/confidence.ts  src/stats.ts  src/notify.ts
    src/seed.ts  src/index.ts
    test/*.test.ts
  apps/web/                    (Vite, React, Tailwind)
    src/pages/  src/components/  src/store/  src/seo.ts
    public/  scripts/sitemap.mjs
  apps/api/                    (Phase 2)
    src/server.ts  src/routes/  src/db.ts  src/auth.ts
```

## 4. Domain model

All times are milliseconds since the epoch unless the name ends in `Minutes`. Durations stored as minutes (float).

```ts
type TokenStatus = 'waiting' | 'called' | 'serving' | 'completed' | 'missed' | 'cancelled' | 'expired';
type Tier = 'accessibility' | 'appointment' | 'walkin';          // rank 0, 1, 2
type PriorityState = 'none' | 'pending' | 'approved' | 'rejected';
type CounterStatus = 'available' | 'serving' | 'closed';
type PulseLevel = 'calm' | 'busy' | 'critical';

interface Service { id: string; name: string; defaultMinutes: number; }

interface AppointmentSlot { id: string; serviceId: string; startsAt: number; capacity: number; }

interface Customer {
  id: string;                    // unique, internal
  token: string;                 // 'QN-104', unique across the whole AppState
  cancelSecret: string;          // random, returned once at join, required to cancel
  name: string;                  // 1 to 60 chars, trimmed
  serviceId: string;
  joinedAt: number;
  queueTime: number;             // ordering key inside a tier. Starts equal to joinedAt.
  slotId: string | null;         // set only when joined as a valid appointment
  priority: PriorityState;       // 'pending' until staff decide
  status: TokenStatus;
  counterId: string | null;      // set while called or serving
  calledAt: number | null;
  servingStartedAt: number | null;
  completedAt: number | null;
  missedAt: number | null;
  missedCount: number;
  estimateAtJoin: number | null; // minutes, null if no compatible counter at join
  estimatedWaitMinutes: number | null; // current estimate, null if none
  lastNotifiedEta: number | null;
  approachingNotified: boolean;
}

interface Counter {
  id: string; name: string;
  serviceIds: string[];
  status: CounterStatus;
  currentTokenId: string | null; // invariant: status === 'serving' iff this is not null
}

interface ServiceRecord {
  tokenId: string; serviceId: string; counterId: string;
  startedAt: number; endedAt: number; durationMinutes: number;
  estimateAtJoin: number | null; actualWaitMinutes: number;
  simulated: boolean;            // true for seeded demo records
}

interface CounterLogEntry { counterId: string; status: CounterStatus; at: number; }

interface Notification {
  id: string; tokenId: string | null;  // null means for staff
  kind: 'approaching' | 'eta_changed' | 'called' | 'counter_closed' | 'completed' | 'missed'
      | 'pulse_critical' | 'grace_expired' | 'recommendation';
  message: string; createdAt: number; read: boolean;
}

interface ActivityEntry { id: string; at: number; text: string; }

interface PulseSnapshot { at: number; waiting: number; newArrivalEta: number | null; compatibleOpen: number; level: PulseLevel; }

interface Settings {
  calmMax: number;                // default 5
  busyMax: number;                // default 12
  approachingAhead: number;       // default 2
  significantEtaChangeMinutes: number; // default 5
  graceMinutes: number;           // default 5
  maxMisses: number;              // default 2
  missedPolicy: 'requeue_last_in_tier' | 'expire'; // default requeue_last_in_tier
  appointmentEarlyMinutes: number; // default 10
  appointmentLateMinutes: number;  // default 15
  confidenceMaxCv: number;         // default 0.35
  confidenceWindowMinutes: number; // default 10
  maxWaiting: number;              // default 200 (abuse limit)
}

interface OrgState {
  id: string; name: string;
  services: Service[]; slots: AppointmentSlot[]; counters: Counter[];
  customers: Customer[];                 // trimmed: terminal tokens older than 24 h are removed
  records: ServiceRecord[];              // keep last 200
  counterLog: CounterLogEntry[];         // keep last 200
  notifications: Notification[];         // keep last 500
  activity: ActivityEntry[];             // keep last 200
  pulseHistory: Record<string, PulseSnapshot[]>; // per serviceId, keep last 10
  stats: { registrations: number; completed: number; cancelled: number; expired: number; peakWaiting: number };
  settings: Settings;
}

interface AppState { schemaVersion: 1; nextSeq: number; orgs: Record<string, OrgState>; }
```

Token format: `QN-` plus `nextSeq`, then `nextSeq += 1`. Initial `nextSeq` is 101. Tokens are unique across all organisations.

## 5. Engine API and invariants

```ts
type Action =
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

type ErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'INVALID_STATE' | 'COUNTER_CLOSED' | 'COUNTER_BUSY'
  | 'LAST_ACTIVE_COUNTER' | 'NO_ELIGIBLE_TOKEN' | 'NO_COMPATIBLE_COUNTER' | 'SLOT_FULL'
  | 'SLOT_OUT_OF_WINDOW' | 'QUEUE_FULL' | 'FORBIDDEN';

type Result =
  | { ok: true; state: AppState; token?: string; cancelSecret?: string }
  | { ok: false; code: ErrorCode; message: string };

function apply(state: AppState, action: Action, now: number, random: () => number): Result;
function resetDemo(now: number, random: () => number): AppState;   // returns fresh seeded state
```

`apply` never mutates its input and never throws for invalid user actions: it returns `ok: false` with a message that the UI can show as is. Messages are plain sentences with no exclamation marks.

Status transitions (anything else returns `INVALID_STATE`):

| From | Action | To |
|---|---|---|
| (new) | join | waiting |
| waiting | callNext | called (counter becomes serving) |
| called | startService | serving |
| serving | completeService | completed (counter becomes available) |
| called | markMissed | missed (counter becomes available, missedCount + 1) |
| missed | recallMissed | called (on the given counter) |
| missed | returnMissedToQueue | waiting (queueTime = now) |
| missed | tick after grace | waiting if policy requeue and missedCount < maxMisses, else expired |
| waiting | skip | waiting (queueTime = now, goes to the end of its tier) |
| waiting, called, missed | cancel | cancelled (frees counter if called) |

Counter rules enforced in the engine (not only in the UI):
1. A counter holds at most one token. `callNext` on a counter with `currentTokenId` set returns `COUNTER_BUSY`.
2. `callNext` on a closed counter returns `COUNTER_CLOSED`.
3. `closeCounter` on a counter with a token returns `COUNTER_BUSY` with the message `Cannot close while serving QN-104. Complete the service first.`
4. `closeCounter` when it would leave no non-closed counter returns `LAST_ACTIVE_COUNTER`.
5. `setCounterServices` on a counter with a token returns `COUNTER_BUSY`. The list must be non-empty and contain existing service ids.
6. `callNext` picks the eligible waiting token with the lowest order key (section 6) among tokens whose service the counter supports. None: `NO_ELIGIBLE_TOKEN`.
7. Every successful action recalculates `estimatedWaitMinutes` for all waiting tokens (section 7), appends to `counterLog` when a counter status changes, appends a `PulseSnapshot` for each service whose queue changed, runs notification rules (section 12), appends to `activity`, and updates `stats.peakWaiting`.
8. `tick` only does time-based work: grace-period expiry and recalculating estimates (elapsed time changes the remaining time of active services). It does not append `PulseSnapshot` entries and does not count as a queue change.

Join validation:
- `name` trimmed, 1 to 60 characters, no control characters. Otherwise `VALIDATION`.
- `serviceId` must exist in the org.
- `slotId` given: the slot must exist, belong to the service, and be valid now (section 6), otherwise `SLOT_OUT_OF_WINDOW`; and its `capacity` must exceed the number of non-cancelled customers already using it, otherwise `SLOT_FULL`.
- Waiting count at or above `maxWaiting`: `QUEUE_FULL`.

## 6. FairTurn: ordering and priority validation

Order key for a waiting customer: `(tierRank, queueTime, token sequence number)`, ascending.

Effective tier:
1. `accessibility` (rank 0) only when `priority === 'approved'`.
2. `appointment` (rank 1) when `slotId` is set and the customer is not accessibility.
3. `walkin` (rank 2) otherwise.

Rules:
- Priority is never self-granted. A request sets `priority = 'pending'`. While pending or rejected, the customer is ordered by their base tier (appointment or walkin). Staff `approvePriority` moves them to rank 0, keeping their original `queueTime` so FIFO inside the tier still holds. `rejectPriority` sets `rejected`.
- Appointment validity: a slot is valid now when `slot.startsAt - appointmentEarlyMinutes*60000 <= now <= slot.startsAt + appointmentLateMinutes*60000`. Outside that window the join form offers walk-in instead (design.md 4.2).
- The join page shows the same rules in plain text (design.md 4.2). The rules shown must be generated from `settings`, so text and behaviour cannot drift.
- Collect only: name, service, slot, priority request. Nothing else.

## 7. Estimated wait and return window

Average service minutes for a service: mean of `durationMinutes` of the last 10 records for that service. If there are no records, `service.defaultMinutes`.

`estimateWaitFor(org, tokenId, now): number | null`

```
target = customer with tokenId (status waiting)
compatible = counters where status != 'closed' and serviceIds includes target.serviceId
if compatible is empty: return null          // UI shows "Waiting for an available counter"

free = map from every non-closed counter id to minutes until it is free:
   available -> 0
   serving or called with token t -> max(0, avg(t.serviceId) - elapsedMinutes)
      where elapsedMinutes = (now - (t.servingStartedAt ?? t.calledAt)) / 60000

ahead = waiting customers with order key before target's, in order
for each t in ahead:
   candidates = non-closed counters whose serviceIds include t.serviceId
   if none: continue
   c = candidate with the smallest free[c] (ties: lowest counter id)
   free[c] = free[c] + avg(t.serviceId)

return ceil( min of free[c] for c in compatible )
```

The result is the time until the target would start service. Check against the simple formula: 12 people ahead, same service, 3 available counters, average 5 minutes: each counter takes 4 people (20 minutes), minimum is 20, so the estimate is 20. This equals `12 * 5 / 3`.

`estimateForNewArrival(org, serviceId, now)`: same algorithm with a virtual walk-in appended after all current waiting walk-ins (it sorts after every waiting walk-in because its `queueTime` is `now`). Used by QueuePulse and the join page preview.

People ahead (shown on the pass) is the count of waiting customers ahead of the target with the same `serviceId`. The estimate also accounts for other services that compete for the same counters, so the number of people ahead and the estimate can differ. The pass shows the label `People ahead in your service`.

Return window from an estimate `e` (minutes):
- `e <= 5`: no window, text `Stay nearby, your turn is close`.
- otherwise: start = `e - 5`, end = `e - 3`. Example: 20 gives 15 to 17, matching the original document. Text: `Come back in {start} to {end} minutes`.
- `e` null: no window.

Recalculate estimates after every successful action and every `tick`.

## 8. QueuePulse and AutoCounter

Per service, `waiting` = count of waiting customers with that `serviceId`.

Level: `waiting <= calmMax` calm, `waiting <= busyMax` busy, otherwise critical. Defaults 5 and 12 give calm 0 to 5, busy 6 to 12, critical 13 and above, as in the original document.

Reason sentence (shown next to the badge):
- calm: `Calm. {n} waiting for {service}. {k} compatible counters open.`
- busy: `Busy. {n} waiting for {service}. Estimated wait for a new arrival is {e} minutes.`
- critical: `Critical. {n} waiting for {service}. Estimated wait for a new arrival is {e} minutes and is {rising|not rising}.`
If `e` is null use `No compatible counter is open.` in place of the estimate.

Rising: the last three `PulseSnapshot.newArrivalEta` values for the service are all non-null, each at least the one before, and the last is greater than the first.

Staff alert: when a service's level changes to critical after an action, add a staff notification of kind `pulse_critical`.

`getRecommendations(org, now): Recommendation[]` is a pure function of state (not stored). One result per service at most, first matching rule wins:

1. Level critical:
   - There is a closed counter supporting the service: `open_counter` naming the lowest-id one. Reason: `Queue pressure is Critical. {n} customers are waiting for {service} and the estimated wait is {rising|steady}. Open {counter} if staff are available.`
   - Else a non-closed `available` counter that does not support the service: `reassign_counter`. Reason names the counter and the service.
   - Else `add_counter`: `All counters that support {service} are already open. Consider adding a counter.`
2. Level busy and rising: `review_allocation`. Reason states the waiting count and the rising estimate, and names a closed compatible counter if one exists.
3. Last five snapshots all calm and at least 2 non-closed counters support the service: `review_staffing`, naming an `available` (idle) compatible counter as the one staff could close. Only produced when closing that counter would still leave at least one non-closed counter overall and at least one non-closed counter supporting the service. A serving counter is never named.

Hard guards for the recommender (also enforced by actions in section 5): never recommend closing the last non-closed counter, never recommend closing a counter that has a token, never recommend assigning one counter to two customers. A unit test must assert each guard.

These are rules, not a model. The UI label is `AutoCounter` with the description `Rule-based counter recommendations`.

## 9. Analytics and Flow Score

Stats (all computed from stored records and counters, nothing invented):

| Metric | Definition |
|---|---|
| Total registrations | `stats.registrations` |
| Completed services | `stats.completed` |
| Average service duration | mean `durationMinutes` of `records`, minutes with one decimal. Empty: `No data yet` |
| Peak queue length | `stats.peakWaiting` |
| Active counters | count of counters not closed |
| Estimated versus actual | mean `estimateAtJoin` and mean `actualWaitMinutes` over records with a non-null estimate |
| Counter utilisation | per counter: serving minutes divided by minutes the counter was not closed, within the window covered by `counterLog` and `records`. Serving minutes = sum of `durationMinutes` of its records. If open minutes is 0: `No data yet` |

Flow Score (label in the UI: `Flow Score (QueueNova demo formula)`):

```
terminal = stats.completed + stats.cancelled + stats.expired
completionRate = completed / terminal                 // if terminal is 0: no score
waitPerformance = share of records where actualWaitMinutes <= estimateAtJoin + 5
                  (records with null estimate are excluded; if none: no score)
flowScore = round( 100 * (0.5 * completionRate + 0.5 * waitPerformance) )
```

Show the two components and the formula under the score. When either component is missing show `Not enough data yet`. Never present it as an industry standard. The counts come from `stats`, so trimming old customers from the list does not change the score. The engine increments `stats.cancelled` and `stats.expired` when a token reaches those states.

Seeded records have `simulated: true`. The admin analytics page shows the count of simulated records and the label `Includes simulated demo data` when any exist.

## 10. Queue Confidence

`getConfidence(org, serviceId, now): 'stable' | 'changing' | 'insufficient'`
- Take the last 5 `durationMinutes` for the service. Fewer than 3: `insufficient` (UI text: `Not enough data yet`).
- Coefficient of variation = standard deviation divided by mean. Mean 0: `changing`.
- If any `counterLog` entry within `confidenceWindowMinutes` belongs to a counter that supports the service: `changing`.
- `cv <= confidenceMaxCv` (default 0.35): `stable`, else `changing`.
It is a qualitative label. Do not show a percentage.

## 11. Missed-turn recovery

- `markMissed` on a called counter: token becomes `missed`, `missedAt = now`, `missedCount += 1`, counter becomes available. Staff notification and customer notification (section 12).
- Grace deadline: `missedAt + graceMinutes * 60000`. The admin list shows time left.
- Before the deadline staff can `recallMissed` (token goes to `called` on a given available, compatible, non-closed counter, else `NO_COMPATIBLE_COUNTER`) or `returnMissedToQueue` (back to `waiting`, `queueTime = now`).
- On `tick` after the deadline: if `missedPolicy` is `requeue_last_in_tier` and `missedCount < maxMisses`, the token returns to waiting with `queueTime = now`; otherwise it becomes `expired`. Add a staff notification `grace_expired` and a customer notification.
- Every transition recalculates estimates, so affected customers see updated waits.

## 12. NovaNotify rules and messages

All notifications are stored in `org.notifications` and shown in the app. Cap 500 per org, oldest dropped first. Messages have no emoji and no exclamation marks.

| Trigger | Recipient | Message |
|---|---|---|
| People ahead in own service drops to `approachingAhead` or below, first time (`approachingNotified`) | customer | `Your turn is approaching. Token {token} has {n} ahead in {service}. Please stay near the counters.` |
| `abs(new estimate - lastNotifiedEta) >= significantEtaChangeMinutes` (lastNotifiedEta starts as `estimateAtJoin`, updated whenever a message is sent) | customer | `Estimated wait for token {token} changed from {old} to {new} minutes.` |
| Customer called | customer | `Token {token} is called. Please go to {counter}.` |
| Counter closed and a waiting customer's estimate changed | customer | `{counter} closed. Estimated wait for token {token} is now {e} minutes.` |
| Service completed | customer | `Service for token {token} is complete. Thank you.` |
| Marked missed | customer | `Token {token} was marked missed. You can be recalled until {time}.` |
| Level becomes critical | staff | `{service} queue is Critical with {n} waiting.` |
| Grace expired | staff | `Token {token} grace period ended and the token was {requeued|expired}.` |

The estimate from null to a number (counter opened) or number to null (last compatible counter closed) always sends an `eta_changed`-style message: `Waiting for an available counter` or the new estimate.

## 13. Persistence and sync

Phase 1:
- localStorage key `queuenova.state.v1` holds JSON of `AppState`. Every successful dispatch writes it inside try/catch. If storage is unavailable, keep working in memory and show a small notice.
- On load: parse and check `schemaVersion === 1` and basic shape. Anything else: discard and call `resetDemo`.
- Cross-tab sync: post the new state version on `BroadcastChannel('queuenova')`; other tabs replace their state. Fallback: the `storage` event.
- `resetDemo` regenerates seed data with timestamps relative to `now`, so slots and durations look current. Also clear the pass secret stored for the visitor's token.
- localStorage never syncs across devices. State this on the landing page limits box (design.md 4.1).

Phase 2:
- `org_state(org_id text primary key, version int not null, state jsonb not null, updated_at timestamptz not null)`.
- Handler: read row, `engine.apply`, `UPDATE ... SET state = $1, version = version + 1 WHERE org_id = $2 AND version = $3`. Zero rows updated means a concurrent write: reload and retry up to 3 times, then return HTTP 409.
- Why JSONB: the engine is the source of rules, state per org is small (trimmed as in section 4), and one row per org makes every action atomic. Normalised tables are a later step if multi-org scale is needed.

## 14. HTTP API (Phase 2)

Base path `/api/v1`. JSON only. All bodies validated with zod. Errors use `{ "error": { "code": "...", "message": "..." } }` with the engine error codes, mapped: `VALIDATION` 400, `FORBIDDEN` 403, `NOT_FOUND` 404, `INVALID_STATE` and conflicts 409, `QUEUE_FULL` 429.

Public:
- `GET /orgs` list organisations and services.
- `GET /orgs/:orgId/snapshot` queue snapshot for /live: counters (name, status, current token), waiting counts per service, pulse level and reason, recommendations, estimated wait for a new arrival per service, recent activity. It contains token numbers only, never customer names.
- `POST /orgs/:orgId/tokens` join. Returns token and `cancelSecret`. Rate limit 10 per minute per IP.
- `GET /orgs/:orgId/tokens/:token` pass view: status, service, people ahead, estimate, return window, confidence, serving info, that token's notifications. No name field.
- `POST /orgs/:orgId/tokens/:token/cancel` requires `cancelSecret` in the body.
- `GET /orgs/:orgId/events` Server-Sent Events: emits `snapshot` with the version number whenever state changes. Client falls back to polling the snapshot every 5 seconds if the stream drops.
- `GET /orgs/:orgId/slots` slots and whether each is valid now.
- `GET /healthz`

Admin (cookie required):
- `POST /admin/login`, `POST /admin/logout`
- `GET /orgs/:orgId/admin/state` full org state including names
- `POST /orgs/:orgId/counters/:counterId/call-next | start | complete | miss | open | close`
- `POST /orgs/:orgId/counters` add, `PATCH /orgs/:orgId/counters/:counterId` set services
- `POST /orgs/:orgId/tokens/:tokenId/recall | return | skip | approve-priority | reject-priority`
- `PATCH /orgs/:orgId/settings`
- `GET /orgs/:orgId/stats`
- `POST /orgs/:orgId/demo/reset` only when `DEMO_MODE=true`

The server runs `tick` itself on a 15 second timer per active org and on every request, so grace periods expire even when no admin page is open.

## 15. Rendering and delivery architecture

- Static routes (`/`, `/join`, `/live`, `/pass`, `/admin`, `/admin/counters`, `/terms`, `/privacy`, `404`) are prerendered to HTML at build time with their own head tags (design.md 3.2).
- The parts of a page that depend on queue state render only after mount. Prerendered HTML contains no queue numbers.
- `/pass` is one static page. It reads the token from the query string `?t=` and the visitor's `cancelSecret` from localStorage.
- Unknown paths get `404.html` with status 404 from the host. The client router also renders the same NotFound page for unknown client routes.
- Sitemap and robots follow design.md 3.4. `noindex` is in the HTML head of `/pass`, `/admin`, `/admin/counters` and 404.
- JS is split per route. Budget and measuring commands are in techstack.md section 7.

## 16. Security and privacy

- All user text is rendered through React (escaped). Never use `dangerouslySetInnerHTML`.
- Customer names never appear on public pages or in public API responses. Only admin sees them.
- Collect only the fields in section 4. No phone, email, ID numbers or payment data. The join form says so.
- Phase 1 admin is open and labelled as a demo (design.md 4.5). Do not describe it as secure anywhere.
- Phase 2: passcode in environment, constant-time compare, signed session cookie (httpOnly, Secure, SameSite=Lax), rate limit on login (5 per 15 minutes per IP), custom header required on mutating admin requests, CORS limited to the site origin, Helmet headers, request body size limit 10 KB.
- `cancelSecret` is 8 random characters from `[a-z0-9]` generated with the supplied `random` function in tests and with `crypto.randomInt` in production wiring.
- Logs must not include names or secrets.
- The privacy policy must describe exactly the above. Update it with any change to what is stored.

## 17. Test cases (Vitest, all must pass)

Use a fixed `now` and a deterministic `random`. Fixture: one org, service A with default 5 minutes, counters C1 to C3 all supporting A.

1. ETA formula check: 3 available counters, 12 waiting customers for A ahead, no records: estimate for the 13th customer is 20.
2. Return window for estimate 20 is 15 to 17. For estimate 5 and 3 there is no window and the text is `Stay nearby, your turn is close`.
3. No compatible counter (all closed): estimate is null, UI text `Waiting for an available counter`, no exception, no division by zero.
4. Counters C2 and C3 closed, C1 serving a token started 2 minutes ago (average 5), nobody else waiting, new arrival for A: estimate is 3.
5. Order: approved priority, then appointment, then walk-in. Same tier orders by `queueTime`. A walk-in who joined first is called after a later appointment holder.
6. Pending priority does not change order. Approve moves the token to rank 0 and keeps its original `queueTime`. Reject leaves it in its base tier.
7. `callNext` picks only tokens the counter supports. A counter that supports none of the waiting services returns `NO_ELIGIBLE_TOKEN`.
8. `callNext` on a serving counter returns `COUNTER_BUSY`. On a closed counter returns `COUNTER_CLOSED`.
9. `closeCounter` on a serving counter returns `COUNTER_BUSY` with the exact message in section 5. After `completeService` the same close succeeds.
10. `closeCounter` on the last non-closed counter returns `LAST_ACTIVE_COUNTER`.
11. QueuePulse levels at 5, 6, 12 and 13 waiting: calm, busy, busy, critical.
12. Critical with a closed compatible counter: recommendation `open_counter` naming that counter. Critical with none closed and an idle non-supporting counter: `reassign_counter`.
13. Recommender never names a serving counter or the last non-closed counter for closing (property test over random states, at least 200 cases).
14. Busy with three rising snapshots: `review_allocation`. Five calm snapshots with two idle compatible counters: `review_staffing`.
15. Missed turn: `markMissed` frees the counter and increments `missedCount`. `tick` before grace leaves it missed. `tick` after grace with `missedCount` 1 returns it to waiting at the end of its tier. With `missedCount` equal to `maxMisses` it becomes expired.
16. `recallMissed` with no available compatible counter returns `NO_COMPATIBLE_COUNTER`.
17. Skip moves a waiting token behind other waiting tokens of the same tier and not behind other tiers.
18. Notifications: approaching sent once when ahead drops to 2. ETA change below 5 minutes sends nothing, 5 or more sends one. Called, completed and counter-closed messages match section 12.
19. Join validation: empty name, 61-character name, unknown service, full slot, slot outside window, queue at `maxWaiting` each return the right code.
20. Confidence: fewer than 3 records is `insufficient`. Five records with equal durations is `stable`. A counter status change within 10 minutes forces `changing`.
21. Flow Score: with 8 completed and 2 cancelled, and 6 of 8 records within estimate plus 5, score is `round(100 * (0.5*0.8 + 0.5*0.75))` which is 78. Missing components return no score.
22. Immutability: `apply` returns a new state and leaves the input unchanged (deep-freeze the input in tests).
23. Persistence: a state serialised to JSON and parsed back gives identical results from `apply` for the same action and `now`.

## 18. Seed data and demo script

Seed (`resetDemo`), all clearly fictional:
- Organisation `Demo City Hospital`: services OPD registration (default 5 min), Pharmacy (4), Lab sample (6). Counters: Counter 1 (OPD, Pharmacy) available, Counter 2 (OPD, Lab) serving one token, Counter 3 (Pharmacy) closed, Counter 4 (OPD) closed.
- Organisation `Demo Savings Bank`: services Cash services (4), Account opening (10). Counters: Counter 1 (Cash) available, Counter 2 (Cash, Account opening) available, Counter 3 (Account opening) closed.
- 6 to 8 waiting customers named `Demo visitor 01`, `Demo visitor 02`, and so on, spread across services so the OPD queue starts Busy.
- 15 simulated `ServiceRecord`s per service with durations varying around the default (marked `simulated: true`), so averages and Confidence have data.
- Appointment slots at now minus 10, now, now plus 10, now plus 25 and now plus 45 minutes for each service (capacity 2). The first three are valid now, the last two show as opening later.
- Token sequence starts at 101.

Demo script (maps to section 8 of the original solution). Each step must work using only the UI, with the seed above:
1. Join 3 visitors to OPD registration. Tokens appear, each with people ahead and an estimate.
2. Open a pass. Show estimate and return window, Confidence label, notifications.
3. Join visitors until OPD waiting passes 12. QueuePulse becomes Critical and staff get an alert.
4. Open `/live` or `/admin`. AutoCounter recommends opening Counter 4 and shows the reason. Click Open on Counter 4. Estimates drop.
5. Close Counter 4 again (it is not serving, so this is allowed). Estimates rise and waiting customers receive the counter-closed notification. Try to close Counter 2 while serving: the visible block message appears.
6. Call next on Counter 1, start service, complete. Dashboard counts, pass and notifications update in a second tab.
7. Call next, mark the token missed, show the grace countdown, recall it. Then mark another missed and let grace pass (use the `tick` interval or the demo grace setting of 1 minute) to show it returning to the queue.
8. Reset demo data and confirm the app returns to the seeded state.

Done means: all 23 tests pass, the 8 demo steps work in two browser tabs without a page reload, and `npm run qa` passes.
