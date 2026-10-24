// apps/web/src/store/authStore.ts
// Authentication and initial loading flow store for QueueNova.
// Complies with design.md hard rules (flat colours, no emoji, 6px radius).

import { create } from 'zustand';

export interface AuthUser {
  name: string;
  email: string;
  role: 'admin' | 'staff';
}

interface AuthState {
  hasLoaded: boolean;
  isLoading: boolean;
  loadingProgress: number;
  loadingStepText: string;
  isAuthenticated: boolean;
  user: AuthUser | null;

  startLoading: (onComplete?: () => void) => void;
  skipLoading: () => void;
  resetLoading: () => void;
  login: (email: string, password?: string) => boolean;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'queuenova.auth.session.v1';

function getSavedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Session storage not available
  }
  return null;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const initialUser = getSavedUser();

  return {
    hasLoaded: false,
    isLoading: false,
    loadingProgress: 0,
    loadingStepText: 'Initializing QueueNova queue engine...',
    isAuthenticated: !!initialUser,
    user: initialUser,

    startLoading: (onComplete) => {
      set({
        isLoading: true,
        loadingProgress: 5,
        loadingStepText: 'Initializing QueueNova queue engine...',
      });

      const steps = [
        { progress: 28, text: 'Connecting to real-time queue stream...' },
        { progress: 56, text: 'Synchronizing active counter stations...' },
        { progress: 84, text: 'Verifying security context and rules...' },
        { progress: 100, text: 'Ready. Redirecting to sign in...' },
      ];

      let currentStepIndex = 0;

      const interval = setInterval(() => {
        if (currentStepIndex < steps.length) {
          const step = steps[currentStepIndex];
          set({
            loadingProgress: step.progress,
            loadingStepText: step.text,
          });
          currentStepIndex += 1;
        } else {
          clearInterval(interval);
          set({
            isLoading: false,
            hasLoaded: true,
            loadingProgress: 100,
          });
          if (onComplete) {
            onComplete();
          }
        }
      }, 450);
    },

    skipLoading: () => {
      set({
        isLoading: false,
        hasLoaded: true,
        loadingProgress: 100,
        loadingStepText: 'Ready.',
      });
    },

    resetLoading: () => {
      set({
        hasLoaded: false,
        isLoading: false,
        loadingProgress: 0,
        loadingStepText: 'Initializing QueueNova queue engine...',
      });
    },

    login: (email: string, _password?: string) => {
      const cleanEmail = email.trim();
      if (!cleanEmail) return false;

      const role = cleanEmail.includes('admin') ? 'admin' : 'staff';
      const name = role === 'admin' ? 'Admin Officer' : 'Queue Staff';
      const loggedUser: AuthUser = {
        name,
        email: cleanEmail,
        role,
      };

      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify(loggedUser)
          );
        } catch {
          // Ignore storage issues
        }
      }

      set({
        isAuthenticated: true,
        user: loggedUser,
      });

      return true;
    },

    logout: () => {
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {
          // Ignore
        }
      }
      set({
        isAuthenticated: false,
        user: null,
      });
    },
  };
});
