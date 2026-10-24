import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueueStore } from '../store/queueStore.js';
import { useAuthStore } from '../store/authStore.js';
import { LogOut, User } from 'lucide-react';

export const Header: React.FC = () => {
  const location = useLocation();
  const { appState, selectedOrgId, setSelectedOrgId } = useQueueStore();
  const { isAuthenticated, user, logout } = useAuthStore();
  const orgs = Object.values(appState.orgs);

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-40">
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-3 text-ink font-semibold text-lg hover:text-primary transition-colors focus:outline-none"
            aria-label="QueueNova home page"
          >
            {/* 3 rising bars logo SVG */}
            <svg
              className="w-8 h-8 rounded-[6px]"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="64" height="64" rx="12" fill="#0E5A63" />
              <rect x="14" y="32" width="8" height="18" fill="#F7F8F6" />
              <rect x="28" y="22" width="8" height="28" fill="#F7F8F6" />
              <rect x="42" y="12" width="8" height="38" fill="#F7F8F6" />
            </svg>
            <span className="tracking-tight font-semibold text-xl">QueueNova</span>
          </Link>

          <span
            className="text-xs font-medium px-2 py-0.5 rounded-[4px] border border-border text-ink-muted bg-bg select-none"
            title="Seeded demo records"
          >
            Demo data
          </span>
        </div>

        <nav className="flex items-center gap-1 sm:gap-3 text-sm font-medium" aria-label="Main navigation">
          <Link
            to="/dashboard"
            className={`px-3 py-2 rounded-[6px] transition-colors ${
              location.pathname === '/dashboard' || location.pathname.startsWith('/admin')
                ? 'text-primary font-semibold bg-bg'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/live"
            className={`px-3 py-2 rounded-[6px] transition-colors ${
              location.pathname === '/live'
                ? 'text-primary font-semibold bg-bg'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Live queue
          </Link>
          <Link
            to="/join"
            className={`px-3 py-2 rounded-[6px] transition-colors ${
              location.pathname === '/join'
                ? 'text-primary font-semibold bg-bg'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Join queue
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-ink-muted font-medium">
                <User className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>{user?.name.split(' ')[0] || 'Staff'}</span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="px-2.5 py-1.5 rounded-[6px] text-xs font-medium text-critical hover:bg-critical-bg border border-border hover:border-critical/30 transition-colors inline-flex items-center gap-1"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold border transition-colors ${
                location.pathname === '/login'
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface text-ink border-border hover:border-primary'
              }`}
            >
              Sign in
            </Link>
          )}

          {orgs.length > 1 && (
            <div className="hidden lg:flex items-center pl-2 border-l border-border">
              <label htmlFor="org-select" className="sr-only">
                Select organisation
              </label>
              <select
                id="org-select"
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="text-xs h-8 px-2 bg-surface border border-border rounded-[6px] text-ink focus:outline-none"
              >
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
