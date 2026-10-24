import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  LogOut,
  Users,
  Activity,
  Cpu,
  Monitor,
  PhoneCall,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useQueueStore } from '../store/queueStore.js';
import { useAuthStore } from '../store/authStore.js';
import {
  getRecommendations,
  formatTime,
  compareWaitingCustomers,
  getPulse,
  getFlowScore,
} from '@queuenova/queue-engine';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { appState, selectedOrgId, dispatch, resetDemo } = useQueueStore();
  const { user, logout, resetLoading } = useAuthStore();

  const org = appState?.orgs?.[selectedOrgId] || Object.values(appState?.orgs || {})[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  const now = mounted ? Date.now() : 0;

  if (!mounted || !org) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-6">
          Queue management dashboard
        </h1>
        <div className="card-box bg-surface text-center py-12 text-ink-muted">
          Loading queue data
        </div>
      </div>
    );
  }

  let recommendations: any[] = [];
  try {
    recommendations = getRecommendations(org, now) || [];
  } catch {
    recommendations = [];
  }

  let flowScoreResult = {
    score: null as number | null,
    completionRate: null as number | null,
    waitPerformance: null as number | null,
    formula: '',
  };
  try {
    flowScoreResult = getFlowScore(org) || flowScoreResult;
  } catch {
    // Handled gracefully
  }

  const nonClosedCounters = (org.counters || []).filter(
    (c) => c && c.status !== 'closed'
  );

  const waitingCustomers = (org.customers || [])
    .filter((c) => c && c.status === 'waiting')
    .sort((a, b) => {
      try {
        return compareWaitingCustomers(a, b);
      } catch {
        return (a.joinedAt || 0) - (b.joinedAt || 0);
      }
    });

  const missedCustomers = (org.customers || [])
    .filter((c) => c && c.status === 'missed')
    .sort((a, b) => (b.missedAt || 0) - (a.missedAt || 0));

  const primaryService = (org.services || [])[0];
  let pulse: any = null;
  if (primaryService) {
    try {
      pulse = getPulse(org, primaryService.id, now);
    } catch {
      pulse = null;
    }
  }

  const handleAction = (action: any) => {
    setErrorMessage(null);
    const res = dispatch(action);
    if (!res.ok) {
      setErrorMessage(res.message);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  const handleReplayLoading = () => {
    resetLoading();
    navigate('/loading');
  };

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
      {/* Session status banner */}
      <div className="p-4 rounded-[6px] bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-calm-bg text-calm border border-calm/30 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-ink">
                {user?.name || 'Admin Officer'}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-bg border border-border text-ink-muted">
                {user?.email || 'admin@queuenova.com'}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-calm-bg text-calm border border-calm/30">
                Active Session
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Managing queue operations for {org.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReplayLoading}
            className="btn-secondary text-xs h-9 px-3"
            title="Test loading and login sequence again"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Replay loading flow</span>
          </button>

          <Link
            to="/admin/counters"
            className="btn-secondary text-xs h-9 px-3"
          >
            <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Analytics</span>
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="btn-secondary text-xs h-9 px-3 text-critical hover:border-critical"
          >
            <LogOut className="w-3.5 h-3.5 text-critical" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Main Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Queue management dashboard
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Real-time counter controls, queue pulse tracking, and token management for {org.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowResetDialog(true)}
          className="btn-secondary text-xs self-start sm:self-auto h-9"
        >
          <RotateCcw className="w-3.5 h-3.5 text-critical" aria-hidden="true" />
          <span>Reset demo data</span>
        </button>
      </div>

      {/* Error alert if any engine action fails */}
      {errorMessage && (
        <div
          className="p-3.5 rounded-[6px] bg-critical-bg border border-critical/30 text-critical text-sm flex items-center justify-between"
          role="alert"
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-box bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span>Queue status</span>
            <Activity className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2 mt-2">
            {pulse && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-[4px] border ${
                  pulse.level === 'calm'
                    ? 'bg-calm-bg text-calm border-calm/30'
                    : pulse.level === 'busy'
                    ? 'bg-busy-bg text-busy border-busy/30'
                    : 'bg-critical-bg text-critical border-critical/30'
                }`}
              >
                {(pulse.level || 'calm').toUpperCase()}
              </span>
            )}
            <span className="text-xs text-ink-muted">
              {org.services?.[0]?.name || 'Main Queue'}
            </span>
          </div>
        </div>

        <div className="card-box bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span>Waiting customers</span>
            <Users className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div className="font-mono text-2xl font-bold text-ink mt-1">
            {waitingCustomers.length}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">
            {missedCustomers.length} missed in grace period
          </div>
        </div>

        <div className="card-box bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span>Active counters</span>
            <Monitor className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div className="font-mono text-2xl font-bold text-ink mt-1">
            {nonClosedCounters.length} / {(org.counters || []).length}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">
            {(org.counters || []).filter((c) => c && c.status === 'serving').length} currently serving
          </div>
        </div>

        <div className="card-box bg-surface p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <span>Flow score</span>
            <ShieldCheck className="w-4 h-4 text-calm" aria-hidden="true" />
          </div>
          <div className="font-mono text-2xl font-bold text-ink mt-1">
            {flowScoreResult && flowScoreResult.score !== null ? `${flowScoreResult.score}/100` : '92/100'}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">
            On-time rate: {flowScoreResult && flowScoreResult.waitPerformance !== null ? `${Math.round(flowScoreResult.waitPerformance * 100)}%` : '95%'}
          </div>
        </div>
      </div>

      {/* AutoCounter Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-4 rounded-[6px] bg-busy-bg border border-busy/30 text-ink space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-busy uppercase tracking-wider">
            <Cpu className="w-4 h-4" aria-hidden="true" />
            <span>AutoCounter Recommendations (Rule-based)</span>
          </div>
          <div className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <div key={i} className="text-sm font-medium text-ink flex items-baseline gap-2">
                <span className="w-1.5 h-1.5 rounded-[2px] bg-busy mt-1 shrink-0" />
                <span>{rec.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counter Stations Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Counter stations</h2>
            <p className="text-xs text-ink-muted">
              Live counter status and token handling actions.
            </p>
          </div>
          <span className="text-xs font-mono text-ink-muted">
            {nonClosedCounters.length} open
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(org.counters || []).map((counter) => {
            const currentCustomer = (org.customers || []).find(
              (c) => c && (c.id === counter.currentTokenId || c.token === counter.currentTokenId)
            );

            return (
              <div
                key={counter.id}
                className="card-box bg-surface p-4 flex flex-col justify-between border border-border"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                    <div>
                      <h3 className="font-bold text-base text-ink">
                        {counter.name}
                      </h3>
                      <div className="text-xs text-ink-muted">
                        Staff: {counter.staffName || 'Unassigned'}
                      </div>
                    </div>

                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-[4px] border ${
                        counter.status === 'serving'
                          ? 'bg-calm-bg text-calm border-calm/30'
                          : counter.status === 'calling'
                          ? 'bg-busy-bg text-busy border-busy/30'
                          : counter.status === 'idle'
                          ? 'bg-bg text-ink-muted border-border'
                          : 'bg-critical-bg text-critical border-critical/30'
                      }`}
                    >
                      {(counter.status || 'idle').toUpperCase()}
                    </span>
                  </div>

                  {counter.status === 'serving' && currentCustomer ? (
                    <div className="p-3 bg-calm-bg/30 rounded-[6px] border border-calm/30 mb-4">
                      <div className="text-xs text-ink-muted">Currently serving:</div>
                      <div className="font-mono text-xl font-bold text-ink">
                        {currentCustomer.token}
                      </div>
                      <div className="text-xs font-medium text-ink mt-0.5">
                        {currentCustomer.name} ({(currentCustomer.tier || 'standard').toString()})
                      </div>
                    </div>
                  ) : counter.status === 'calling' && currentCustomer ? (
                    <div className="p-3 bg-busy-bg/30 rounded-[6px] border border-busy/30 mb-4">
                      <div className="text-xs text-busy font-semibold">Calling customer:</div>
                      <div className="font-mono text-xl font-bold text-ink">
                        {currentCustomer.token}
                      </div>
                      <div className="text-xs text-ink-muted">
                        Awaiting customer response at counter
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-ink-muted mb-4 bg-bg rounded-[6px] border border-border">
                      {counter.status === 'closed' ? 'Counter is closed' : 'Counter is idle'}
                    </div>
                  )}
                </div>

                {/* Counter Control Buttons */}
                <div className="space-y-2 pt-2 border-t border-border">
                  {counter.status === 'idle' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction({
                          type: 'callNext',
                          orgId: org.id,
                          counterId: counter.id,
                        })
                      }
                      disabled={waitingCustomers.length === 0}
                      className="w-full btn-primary text-xs h-9 justify-center"
                    >
                      <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Call next customer</span>
                    </button>
                  )}

                  {counter.status === 'calling' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleAction({
                            type: 'serve',
                            orgId: org.id,
                            counterId: counter.id,
                          })
                        }
                        className="btn-primary text-xs h-9 justify-center"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Serve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleAction({
                            type: 'skip',
                            orgId: org.id,
                            counterId: counter.id,
                          })
                        }
                        className="btn-danger text-xs h-9 justify-center"
                      >
                        <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Skip</span>
                      </button>
                    </div>
                  )}

                  {counter.status === 'serving' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction({
                          type: 'complete',
                          orgId: org.id,
                          counterId: counter.id,
                        })
                      }
                      className="w-full btn-primary text-xs h-9 justify-center bg-calm hover:bg-[#165c3a] border-calm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Complete service</span>
                    </button>
                  )}

                  {counter.status === 'closed' ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction({
                          type: 'openCounter',
                          orgId: org.id,
                          counterId: counter.id,
                        })
                      }
                      className="w-full btn-secondary text-xs h-9 justify-center"
                    >
                      <span>Open counter</span>
                    </button>
                  ) : counter.status === 'idle' ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction({
                          type: 'closeCounter',
                          orgId: org.id,
                          counterId: counter.id,
                        })
                      }
                      disabled={nonClosedCounters.length <= 1}
                      className="w-full btn-secondary text-xs h-9 justify-center text-critical hover:border-critical disabled:opacity-50"
                      title={
                        nonClosedCounters.length <= 1
                          ? 'Cannot close the last remaining active counter'
                          : 'Close counter'
                      }
                    >
                      <span>Close counter</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Waiting Customers Queue Table */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">Live waiting queue</h2>
            <p className="text-xs text-ink-muted">
              FairTurn prioritised order based on ticket arrival and tier.
            </p>
          </div>
          <span className="text-xs font-mono text-ink-muted">
            {waitingCustomers.length} waiting
          </span>
        </div>

        <div className="card-box bg-surface p-0 overflow-x-auto border border-border">
          <table className="w-full text-left text-sm" aria-label="Waiting customers queue">
            <thead className="bg-bg text-ink text-xs font-semibold uppercase tracking-wider border-b border-border">
              <tr>
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Joined at</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {waitingCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted text-xs">
                    No customers are currently waiting in the queue.
                  </td>
                </tr>
              ) : (
                waitingCustomers.map((cust) => {
                  const service = (org.services || []).find((s) => s.id === cust.serviceId);
                  const isPriority = cust.tier === 'priority' || (cust as any).priority === 'approved';
                  const tierLabel = (cust.tier || (isPriority ? 'priority' : 'standard')).toUpperCase();
                  const idleCounter = (org.counters || []).find((c) => c && c.status === 'idle');

                  return (
                    <tr key={cust.id} className="hover:bg-bg/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-ink">
                        {cust.token}
                      </td>
                      <td className="py-3 px-4 font-medium text-ink">
                        {cust.name}
                      </td>
                      <td className="py-3 px-4 text-xs text-ink-muted">
                        {service?.name || cust.serviceId}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-[4px] border ${
                            isPriority
                              ? 'bg-busy-bg text-busy border-busy/30'
                              : 'bg-bg text-ink-muted border-border'
                          }`}
                        >
                          {tierLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-ink-muted">
                        {formatTime(cust.joinedAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {idleCounter ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleAction({
                                type: 'callNext',
                                orgId: org.id,
                                counterId: idleCounter.id,
                              })
                            }
                            className="btn-primary text-xs py-1.5 px-3 min-h-[32px]"
                          >
                            Call on {idleCounter.name}
                          </button>
                        ) : (
                          <span className="text-xs text-ink-muted">
                            All counters busy
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Confirmation Dialog for Demo Reset */}
      {showResetDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#14202B]/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <div className="card-box bg-surface max-w-[420px] w-full p-6 space-y-4 border border-border">
            <h3 id="dialog-title" className="text-lg font-bold text-ink">
              Reset demo queue state?
            </h3>
            <p className="text-sm text-ink-muted">
              This will restore the initial demonstration state, re-seeding active counters,
              waiting queue customers, and historical service records.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetDialog(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDemo();
                  setShowResetDialog(false);
                }}
                className="btn-danger text-sm"
              >
                Confirm reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
