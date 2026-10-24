// apps/api/src/state-manager.ts
// Orchestrates: load state from DB, run engine.apply, save with optimistic locking, broadcast SSE.
// Retry up to 3 times on version conflict (architecture.md section 13 Phase 2).

import { apply, resetDemo } from '@queuenova/queue-engine';
import type { Action, AppState, Result } from '@queuenova/queue-engine';
import { loadState, saveState, upsertState, loadAllStates, type StoredState } from './db.js';
import { broadcast } from './sse.js';

const MAX_RETRIES = 3;

// In-memory cache of state per org for tick and snapshot
const stateCache = new Map<string, { version: number; state: AppState }>();

export async function initStateCache(): Promise<void> {
  const all = await loadAllStates();
  for (const s of all) {
    stateCache.set(s.orgId, { version: s.version, state: s.state });
  }
}

export function getCachedState(orgId: string): AppState | null {
  return stateCache.get(orgId)?.state ?? null;
}

export function getAllOrgIds(): string[] {
  return Array.from(stateCache.keys());
}

function cryptoRandom(): number {
  const arr = new Uint32Array(1);
  globalThis.crypto.getRandomValues(arr);
  return arr[0]! / 0xFFFFFFFF;
}

export async function dispatchAction(
  orgId: string,
  action: Action
): Promise<Result> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const stored = await loadState(orgId);
    if (!stored) {
      return { ok: false, code: 'NOT_FOUND', message: `Organisation ${orgId} not found.` };
    }

    const now = Date.now();
    const result = apply(stored.state, action, now, cryptoRandom);
    if (!result.ok) return result;

    const saved = await saveState(orgId, stored.version, result.state);
    if (saved) {
      stateCache.set(orgId, { version: stored.version + 1, state: result.state });
      broadcast(orgId, stored.version + 1);
      return result;
    }
    // Version conflict, retry
  }

  return { ok: false, code: 'INVALID_STATE', message: 'Concurrent update conflict. Please retry.' };
}

// Run tick for an org (server-side timer)
export async function tickOrg(orgId: string): Promise<void> {
  const stored = await loadState(orgId);
  if (!stored) return;

  const now = Date.now();
  const result = apply(stored.state, { type: 'tick', orgId }, now, cryptoRandom);
  if (!result.ok) return;

  const saved = await saveState(orgId, stored.version, result.state);
  if (saved) {
    stateCache.set(orgId, { version: stored.version + 1, state: result.state });
    broadcast(orgId, stored.version + 1);
  }
}

// Reset demo data for an org
export async function resetOrgDemo(orgId: string): Promise<AppState> {
  const now = Date.now();
  const state = resetDemo(now, cryptoRandom);
  await upsertState(orgId, state);
  stateCache.set(orgId, { version: 1, state });
  broadcast(orgId, 1);
  return state;
}

// Seed initial state if no orgs exist
export async function seedIfEmpty(): Promise<void> {
  const all = await loadAllStates();
  if (all.length > 0) return;

  const now = Date.now();
  const state = resetDemo(now, cryptoRandom);

  // Seed each org from the demo state
  for (const orgId of Object.keys(state.orgs)) {
    await upsertState(orgId, state);
    stateCache.set(orgId, { version: 1, state });
  }
}
