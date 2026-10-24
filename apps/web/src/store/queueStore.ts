import { create } from 'zustand';
import {
  AppState,
  Action,
  Result,
  apply,
  resetDemo as engineResetDemo,
} from '@queuenova/queue-engine';

const STORAGE_KEY = 'queuenova.state.v1';
const SECRETS_KEY = 'queuenova.secrets.v1';

export interface QueueStoreInterface {
  getState(): AppState;
  dispatch(action: Action): Result;
  subscribe(listener: () => void): () => void;
  resetDemo(): void;
}

function loadInitialState(): AppState {
  if (typeof window === 'undefined') {
    return engineResetDemo(Date.now());
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.schemaVersion === 1 && parsed.orgs && typeof parsed.orgs === 'object') {
        return parsed;
      }
    }
  } catch {
    // Local storage corrupted or unavailable, fallback to resetDemo
  }

  const seeded = engineResetDemo(Date.now());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    // Ignore storage quota errors
  }
  return seeded;
}

function saveStateToStorage(state: AppState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable
  }
}

export function saveSecret(token: string, secret: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(SECRETS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[token] = secret;
    window.localStorage.setItem(SECRETS_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

export function getSecret(token: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SECRETS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[token] || null;
  } catch {
    return null;
  }
}

export function clearSecrets() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SECRETS_KEY);
  } catch {
    // Ignore
  }
}

interface ZustandState {
  appState: AppState;
  selectedOrgId: string;
  setSelectedOrgId: (orgId: string) => void;
  dispatch: (action: Action) => Result;
  resetDemo: () => void;
  refreshFromExternal: (newState: AppState) => void;
}

export const useQueueStore = create<ZustandState>((set, get) => ({
  appState: loadInitialState(),
  selectedOrgId: 'demo-hospital',
  setSelectedOrgId: (orgId: string) => set({ selectedOrgId: orgId }),
  dispatch: (action: Action): Result => {
    const current = get().appState;
    const now = Date.now();
    const result = apply(current, action, now);

    if (result.ok && result.state) {
      saveStateToStorage(result.state);
      if (result.token && result.cancelSecret) {
        saveSecret(result.token, result.cancelSecret);
      }

      set({ appState: result.state });

      // Broadcast to other tabs
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel('queuenova');
          bc.postMessage({ type: 'STATE_UPDATE', state: result.state });
          bc.close();
        } catch {
          // Ignore broadcast errors
        }
      }
    }

    return result;
  },
  resetDemo: () => {
    const fresh = engineResetDemo(Date.now());
    saveStateToStorage(fresh);
    clearSecrets();
    set({ appState: fresh });

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('queuenova');
        bc.postMessage({ type: 'STATE_UPDATE', state: fresh });
        bc.close();
      } catch {
        // Ignore
      }
    }
  },
  refreshFromExternal: (newState: AppState) => {
    set({ appState: newState });
  },
}));

// Setup BroadcastChannel and storage event listeners for cross-tab sync
if (typeof window !== 'undefined') {
  if ('BroadcastChannel' in window) {
    const bc = new BroadcastChannel('queuenova');
    bc.onmessage = (event) => {
      if (event.data && event.data.type === 'STATE_UPDATE' && event.data.state) {
        useQueueStore.getState().refreshFromExternal(event.data.state);
      }
    };
  }

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.schemaVersion === 1) {
          useQueueStore.getState().refreshFromExternal(parsed);
        }
      } catch {
        // Ignore
      }
    }
  });

  // Single global 15-second tick interval as required in techstack.md section 3
  setInterval(() => {
    const state = useQueueStore.getState().appState;
    for (const orgId of Object.keys(state.orgs)) {
      useQueueStore.getState().dispatch({ type: 'tick', orgId });
    }
  }, 15000);
}

// QueueStore adapter object implementing the interface from techstack.md section 2
export const queueStore: QueueStoreInterface = {
  getState: () => useQueueStore.getState().appState,
  dispatch: (action: Action) => useQueueStore.getState().dispatch(action),
  subscribe: (listener: () => void) => useQueueStore.subscribe(() => listener()),
  resetDemo: () => useQueueStore.getState().resetDemo(),
};
