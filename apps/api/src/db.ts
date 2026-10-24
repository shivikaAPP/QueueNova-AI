// apps/api/src/db.ts
// PostgreSQL state persistence with optimistic concurrency control.
// Table: org_state(org_id text PK, version int, state jsonb, updated_at timestamptz)

import pg from 'pg';
import type { AppState, OrgState } from '@queuenova/queue-engine';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS org_state (
      org_id TEXT PRIMARY KEY,
      version INT NOT NULL DEFAULT 1,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export interface StoredState {
  orgId: string;
  version: number;
  state: AppState;
}

export async function loadState(orgId: string): Promise<StoredState | null> {
  const p = getPool();
  const result = await p.query(
    'SELECT org_id, version, state FROM org_state WHERE org_id = $1',
    [orgId]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    orgId: row.org_id as string,
    version: row.version as number,
    state: row.state as AppState,
  };
}

export async function saveState(
  orgId: string,
  version: number,
  state: AppState
): Promise<boolean> {
  const p = getPool();
  const result = await p.query(
    `UPDATE org_state SET state = $1, version = version + 1, updated_at = NOW()
     WHERE org_id = $2 AND version = $3`,
    [JSON.stringify(state), orgId, version]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function upsertState(
  orgId: string,
  state: AppState
): Promise<void> {
  const p = getPool();
  await p.query(
    `INSERT INTO org_state (org_id, version, state, updated_at)
     VALUES ($1, 1, $2, NOW())
     ON CONFLICT (org_id) DO UPDATE SET state = $2, version = org_state.version + 1, updated_at = NOW()`,
    [orgId, JSON.stringify(state)]
  );
}

export async function loadAllStates(): Promise<StoredState[]> {
  const p = getPool();
  const result = await p.query('SELECT org_id, version, state FROM org_state');
  return result.rows.map((row) => ({
    orgId: row.org_id as string,
    version: row.version as number,
    state: row.state as AppState,
  }));
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
