import React, { useState, useEffect } from 'react';
import { Activity, Users, CheckCircle2, Monitor } from 'lucide-react';
import { useQueueStore } from '../store/queueStore.js';
import { getPulse, getRecommendations, formatTime } from '@queuenova/queue-engine';

export const Live: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const { appState, selectedOrgId } = useQueueStore();
  const org = appState.orgs[selectedOrgId] || Object.values(appState.orgs)[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  const now = mounted ? Date.now() : 0;

  if (!mounted) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-6">
          Live queue status
        </h1>
        <div className="card-box bg-surface text-center py-12 text-ink-muted">
          Loading queue data
        </div>
      </div>
    );
  }

  const waitingCount = org.customers.filter((c) => c.status === 'waiting').length;
  const completedToday = org.stats.completed;
  const activeCounters = org.counters.filter((c) => c.status !== 'closed');
  const recommendations = getRecommendations(org, now);

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Live queue status
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Real-time status for {org.name}. Customer names are never shown on this public board.
          </p>
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded-[4px] border border-border text-ink-muted bg-surface self-start sm:self-auto">
          Demo data
        </span>
      </div>

      {/* Top metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-box bg-surface p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-1">
            <Monitor className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>Active counters</span>
          </div>
          <div className="font-mono text-2xl font-bold text-ink">
            {activeCounters.length}
          </div>
        </div>

        <div className="card-box bg-surface p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-1">
            <Users className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>People waiting</span>
          </div>
          <div className="font-mono text-2xl font-bold text-ink">
            {waitingCount}
          </div>
        </div>

        <div className="card-box bg-surface p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>Completed today</span>
          </div>
          <div className="font-mono text-2xl font-bold text-ink">
            {completedToday}
          </div>
        </div>

        <div className="card-box bg-surface p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>Peak queue length</span>
          </div>
          <div className="font-mono text-2xl font-bold text-ink">
            {org.stats.peakWaiting}
          </div>
        </div>
      </div>

      {/* Currently serving per counter */}
      <div className="card-box bg-surface space-y-4">
        <h2 className="text-lg font-bold text-ink">Counter boards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {org.counters.map((counter) => {
            const activeCust = org.customers.find(
              (c) => c.id === counter.currentTokenId || c.token === counter.currentTokenId
            );
            return (
              <div
                key={counter.id}
                className={`p-4 rounded-[6px] border ${
                  counter.status === 'serving'
                    ? 'bg-calm-bg border-calm/30'
                    : counter.status === 'closed'
                    ? 'bg-bg border-border opacity-70'
                    : 'bg-bg border-border'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-ink-muted mb-2">
                  <span className="font-semibold text-ink">{counter.name}</span>
                  <span
                    className={`font-semibold uppercase ${
                      counter.status === 'serving'
                        ? 'text-calm'
                        : counter.status === 'closed'
                        ? 'text-ink-muted'
                        : 'text-primary'
                    }`}
                  >
                    {counter.status}
                  </span>
                </div>
                <div className="text-xs text-ink-muted mb-1">Serving</div>
                <div className="font-mono text-2xl font-bold text-ink">
                  {activeCust ? activeCust.token : 'None'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per Service QueuePulse & AutoCounter */}
      <div className="card-box bg-surface space-y-6">
        <div className="border-b border-border pb-3">
          <h2 className="text-lg font-bold text-ink">Services and load pressure</h2>
          <p className="text-xs text-ink-muted">QueuePulse tracking and AutoCounter recommendations.</p>
        </div>

        <div className="space-y-4">
          {org.services.map((service) => {
            const pulse = getPulse(org, service.id, now);
            const rec = recommendations.find((r) => r.serviceId === service.id);

            return (
              <div key={service.id} className="p-4 rounded-[6px] border border-border bg-bg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-base text-ink">{service.name}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-[4px] border ${
                        pulse.level === 'calm'
                          ? 'bg-calm-bg text-calm border-calm/30'
                          : pulse.level === 'busy'
                          ? 'bg-busy-bg text-busy border-busy/30'
                          : 'bg-critical-bg text-critical border-critical/30'
                      }`}
                    >
                      {pulse.level.toUpperCase()}
                    </span>
                  </div>

                  <div className="text-sm text-ink-muted">
                    New arrival est. wait:{' '}
                    <strong className="text-ink font-mono font-semibold">
                      {pulse.newArrivalEta !== null ? `${pulse.newArrivalEta} min` : 'No open counter'}
                    </strong>
                  </div>
                </div>

                <div className="text-sm text-ink-muted leading-relaxed">
                  {pulse.reason}
                </div>

                {rec && (
                  <div className="p-3 rounded-[6px] bg-surface border border-border text-xs text-ink space-y-1">
                    <div className="font-semibold text-primary">
                      AutoCounter: Rule-based recommendation
                    </div>
                    <p>{rec.reason}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity (last 10 events) */}
      <div className="card-box bg-surface space-y-4">
        <h2 className="text-lg font-bold text-ink">Recent queue activity</h2>
        {org.activity.length === 0 ? (
          <p className="text-sm text-ink-muted">No activity records yet.</p>
        ) : (
          <div className="divide-y divide-border text-sm">
            {org.activity.slice(0, 10).map((act) => (
              <div key={act.id} className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-ink">{act.text}</span>
                <span className="text-xs text-ink-muted font-mono">{formatTime(act.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Live;
