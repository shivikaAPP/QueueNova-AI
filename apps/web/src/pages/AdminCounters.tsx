import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Sliders, CheckCircle2, Activity, Monitor } from 'lucide-react';
import { useQueueStore } from '../store/queueStore.js';
import {
  getStatsOverview,
  getFlowScore,
  formatTime,
} from '@queuenova/queue-engine';

export const AdminCounters: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [newCounterName, setNewCounterName] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingCounterId, setEditingCounterId] = useState<string | null>(null);
  const [editServicesList, setEditServicesList] = useState<string[]>([]);

  const { appState, selectedOrgId, dispatch } = useQueueStore();
  const org = appState.orgs[selectedOrgId] || Object.values(appState.orgs)[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  const now = mounted ? Date.now() : 0;

  if (!mounted) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-6">
          Counters and analytics
        </h1>
        <div className="card-box bg-surface text-center py-12 text-ink-muted">
          Loading queue data
        </div>
      </div>
    );
  }

  const stats = getStatsOverview(org, now);
  const flowScoreResult = getFlowScore(org);

  const handleAddCounter = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = newCounterName.trim();
    if (!name || name.length > 30) {
      setFormError('Counter name must be between 1 and 30 characters.');
      return;
    }
    if (selectedServices.length === 0) {
      setFormError('Please select at least one supported service.');
      return;
    }

    const res = dispatch({
      type: 'addCounter',
      orgId: org.id,
      name,
      serviceIds: selectedServices,
    });

    if (res.ok) {
      setNewCounterName('');
      setSelectedServices([]);
    } else {
      setFormError(res.message);
    }
  };

  const handleSaveServices = (counterId: string) => {
    setFormError(null);
    if (editServicesList.length === 0) {
      setFormError('Counter must support at least one service.');
      return;
    }

    const res = dispatch({
      type: 'setCounterServices',
      orgId: org.id,
      counterId,
      serviceIds: editServicesList,
    });

    if (res.ok) {
      setEditingCounterId(null);
    } else {
      setFormError(res.message);
    }
  };

  const toggleNewService = (sid: string) => {
    if (selectedServices.includes(sid)) {
      setSelectedServices(selectedServices.filter((s) => s !== sid));
    } else {
      setSelectedServices([...selectedServices, sid]);
    }
  };

  const toggleEditService = (sid: string) => {
    if (editServicesList.includes(sid)) {
      setEditServicesList(editServicesList.filter((s) => s !== sid));
    } else {
      setEditServicesList([...editServicesList, sid]);
    }
  };

  // SVGs for Estimated vs Actual Wait durations
  const estWait = stats.meanEstimatedWaitMinutes ?? 0;
  const actWait = stats.meanActualWaitMinutes ?? 0;
  const maxWait = Math.max(estWait, actWait, 10);
  const estWidth = Math.round((estWait / maxWait) * 200);
  const actWidth = Math.round((actWait / maxWait) * 200);

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to="/admin"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to control centre</span>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Counters and analytics
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Counter status, activity history, service durations and the Flow Score for {org.name}.
          </p>
        </div>

        {stats.simulatedRecordsCount > 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-[4px] border border-border text-ink-muted bg-surface self-start sm:self-auto">
            Includes simulated demo data ({stats.simulatedRecordsCount} records)
          </span>
        )}
      </div>

      {formError && (
        <div
          className="p-4 rounded-[6px] bg-critical-bg border border-critical/30 text-critical text-sm"
          role="alert"
        >
          {formError}
        </div>
      )}

      {/* Analytics Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card-box bg-surface p-4">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
            Registrations
          </div>
          <div className="font-mono text-2xl font-bold text-ink">
            {stats.registrations}
          </div>
        </div>

        <div className="card-box bg-surface p-4">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
            Completed
          </div>
          <div className="font-mono text-2xl font-bold text-ink">
            {stats.completed}
          </div>
        </div>

        <div className="card-box bg-surface p-4">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
            Avg service duration
          </div>
          <div className="font-mono text-2xl font-bold text-ink">
            {stats.avgDurationMinutes !== null ? `${stats.avgDurationMinutes} min` : 'No data yet'}
          </div>
        </div>

        <div className="card-box bg-surface p-4">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
            Peak queue length
          </div>
          <div className="font-mono text-2xl font-bold text-ink">
            {stats.peakWaiting}
          </div>
        </div>

        <div className="card-box bg-surface p-4 col-span-2 md:col-span-1">
          <div className="text-xs text-ink-muted uppercase tracking-wider mb-1">
            Active counters
          </div>
          <div className="font-mono text-2xl font-bold text-ink">
            {stats.activeCounters}
          </div>
        </div>
      </div>

      {/* Flow Score and Wait Accuracy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flow Score Box */}
        <div className="card-box bg-surface space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              Performance Index
            </div>
            <h2 className="text-xl font-bold text-ink">
              Flow Score (QueueNova demo formula)
            </h2>
          </div>

          <div className="flex items-baseline gap-4 py-2">
            <div className="font-mono text-5xl font-bold text-primary">
              {flowScoreResult.score !== null ? flowScoreResult.score : '--'}
            </div>
            <div className="text-sm text-ink-muted">
              {flowScoreResult.score !== null ? '/ 100 points' : 'Not enough data yet'}
            </div>
          </div>

          <div className="space-y-2 text-sm text-ink-muted border-t border-border pt-3">
            <div className="flex justify-between">
              <span>Completion rate:</span>
              <strong className="text-ink font-mono">
                {flowScoreResult.completionRate !== null
                  ? `${Math.round(flowScoreResult.completionRate * 100)}%`
                  : 'No data'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Wait estimate performance (actual &lt;= est + 5):</span>
              <strong className="text-ink font-mono">
                {flowScoreResult.waitPerformance !== null
                  ? `${Math.round(flowScoreResult.waitPerformance * 100)}%`
                  : 'No data'}
              </strong>
            </div>
            <div className="text-xs text-ink-muted pt-2 border-t border-border">
              Formula: <code className="bg-bg px-1.5 py-0.5 rounded text-[11px] font-mono">{flowScoreResult.formula}</code>
            </div>
          </div>
        </div>

        {/* Estimated vs Actual Wait Chart */}
        <div className="card-box bg-surface space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              Accuracy
            </div>
            <h2 className="text-xl font-bold text-ink">Estimated vs actual duration</h2>
            <p className="text-xs text-ink-muted">Mean durations over completed records with initial estimates.</p>
          </div>

          {stats.meanEstimatedWaitMinutes === null ? (
            <p className="text-sm text-ink-muted py-6">Not enough completed records with estimates yet.</p>
          ) : (
            <div className="py-2 space-y-4">
              <div>
                <div className="flex justify-between text-xs text-ink mb-1">
                  <span>Mean estimated wait at join</span>
                  <span className="font-mono font-semibold">{estWait} min</span>
                </div>
                {/* Hand-written SVG Bar */}
                <svg width="100%" height="20" className="rounded-[4px] bg-bg overflow-hidden" aria-label="Estimated wait bar">
                  <rect x="0" y="0" width={`${(estWait / maxWait) * 100}%`} height="20" fill="#0E5A63" />
                </svg>
              </div>

              <div>
                <div className="flex justify-between text-xs text-ink mb-1">
                  <span>Mean actual wait duration</span>
                  <span className="font-mono font-semibold">{actWait} min</span>
                </div>
                {/* Hand-written SVG Bar */}
                <svg width="100%" height="20" className="rounded-[4px] bg-bg overflow-hidden" aria-label="Actual wait bar">
                  <rect x="0" y="0" width={`${(actWait / maxWait) * 100}%`} height="20" fill="#1F7A4D" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Counter Management Table */}
      <div className="card-box bg-surface space-y-4">
        <h2 className="text-lg font-bold text-ink">Counter management</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-xs font-semibold text-ink-muted border-b border-border">
              <tr>
                <th className="p-3">Counter name</th>
                <th className="p-3">Supported services</th>
                <th className="p-3">Status</th>
                <th className="p-3">Current token</th>
                <th className="p-3">Utilisation</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {org.counters.map((counter) => {
                const currentCust = org.customers.find(
                  (c) => c.id === counter.currentTokenId || c.token === counter.currentTokenId
                );
                const isServing = counter.status === 'serving';
                const util = stats.counterUtilisation[counter.id];
                const isEditing = editingCounterId === counter.id;

                return (
                  <tr key={counter.id} className="hover:bg-bg/50">
                    <td className="p-3 font-semibold text-ink">{counter.name}</td>
                    <td className="p-3 text-xs">
                      {isEditing ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-2">
                            {org.services.map((s) => (
                              <label key={s.id} className="flex items-center gap-1 text-xs text-ink cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editServicesList.includes(s.id)}
                                  onChange={() => toggleEditService(s.id)}
                                  className="w-3.5 h-3.5 text-primary"
                                />
                                <span>{s.name}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveServices(counter.id)}
                              className="text-xs font-semibold text-primary underline cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCounterId(null)}
                              className="text-xs text-ink-muted hover:underline cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span>
                          {counter.serviceIds
                            .map((sid) => org.services.find((s) => s.id === sid)?.name || sid)
                            .join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-[4px] border uppercase ${
                          counter.status === 'serving'
                            ? 'bg-calm-bg text-calm border-calm/30'
                            : counter.status === 'closed'
                            ? 'bg-bg text-ink-muted border-border'
                            : 'bg-bg text-primary border-primary/30'
                        }`}
                      >
                        {counter.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-medium text-ink">
                      {currentCust ? currentCust.token : 'None'}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {util !== null && util !== undefined
                        ? `${Math.round(util * 100)}%`
                        : 'No data yet'}
                    </td>
                    <td className="p-3 text-right">
                      {!isEditing && (
                        <button
                          type="button"
                          disabled={isServing}
                          onClick={() => {
                            setEditingCounterId(counter.id);
                            setEditServicesList([...counter.serviceIds]);
                          }}
                          className="text-xs text-primary font-semibold hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
                          title={isServing ? 'Cannot edit services while serving' : 'Edit services'}
                        >
                          Edit services
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Counter Form */}
      <div className="card-box bg-surface space-y-4">
        <h2 className="text-lg font-bold text-ink">Add a new counter</h2>
        <form onSubmit={handleAddCounter} className="space-y-4 max-w-xl">
          <div>
            <label htmlFor="new-counter-name" className="block text-sm font-semibold text-ink mb-1">
              Counter name
            </label>
            <input
              id="new-counter-name"
              type="text"
              value={newCounterName}
              onChange={(e) => setNewCounterName(e.target.value)}
              placeholder="e.g. Counter 5"
              maxLength={30}
              required
              className="input-field"
            />
          </div>

          <div>
            <span className="block text-sm font-semibold text-ink mb-1">
              Supported services
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {org.services.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-2 p-2 rounded-[6px] border border-border bg-bg text-sm text-ink cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(service.id)}
                    onChange={() => toggleNewService(service.id)}
                    className="w-4 h-4 text-primary rounded-[4px]"
                  />
                  <span>{service.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <button type="submit" className="btn-primary">
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Add counter</span>
            </button>
          </div>
        </form>
      </div>

      {/* Activity History Table */}
      <div className="card-box bg-surface space-y-4">
        <h2 className="text-lg font-bold text-ink">Activity history (newest first)</h2>
        {org.activity.length === 0 ? (
          <p className="text-sm text-ink-muted">No activity records recorded yet.</p>
        ) : (
          <div className="divide-y divide-border text-sm max-h-96 overflow-y-auto">
            {org.activity.map((act) => (
              <div key={act.id} className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-ink">{act.text}</span>
                <span className="text-xs text-ink-muted font-mono whitespace-nowrap">
                  {formatTime(act.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCounters;
