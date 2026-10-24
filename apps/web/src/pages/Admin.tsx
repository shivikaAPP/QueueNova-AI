import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCcw,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Bell,
  Cpu,
  Monitor,
} from 'lucide-react';
import { useQueueStore } from '../store/queueStore.js';
import {
  getRecommendations,
  formatTime,
  compareWaitingCustomers,
  getTierRank,
} from '@queuenova/queue-engine';

export const Admin: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { appState, selectedOrgId, dispatch, resetDemo } = useQueueStore();
  const org = appState.orgs[selectedOrgId] || Object.values(appState.orgs)[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  const now = mounted ? Date.now() : 0;

  if (!mounted) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-ink mb-6">
          Admin control centre
        </h1>
        <div className="card-box bg-surface text-center py-12 text-ink-muted">
          Loading queue data
        </div>
      </div>
    );
  }

  const recommendations = getRecommendations(org, now);
  const nonClosedCounters = org.counters.filter((c) => c.status !== 'closed');

  const waitingCustomers = org.customers
    .filter((c) => c.status === 'waiting')
    .sort(compareWaitingCustomers);

  const missedCustomers = org.customers
    .filter((c) => c.status === 'missed')
    .sort((a, b) => (b.missedAt || 0) - (a.missedAt || 0));

  const handleAction = (action: any) => {
    setErrorMessage(null);
    const res = dispatch(action);
    if (!res.ok) {
      setErrorMessage(res.message);
    }
  };

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1 space-y-8">
      {/* Banner per design.md section 4.5 */}
      <div className="p-4 rounded-[6px] bg-busy-bg border border-busy/30 text-busy text-sm font-medium flex items-center justify-between gap-4">
        <div>Demo admin. No sign-in is enforced in this prototype.</div>
        <Link
          to="/admin/counters"
          className="inline-flex items-center gap-1.5 text-ink font-semibold hover:underline"
        >
          <Sliders className="w-4 h-4" aria-hidden="true" />
          <span>Manage counters and analytics</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Admin control centre
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Call, complete, skip and recall tokens, and manage counters for {org.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowResetDialog(true)}
          className="btn-secondary text-sm self-start sm:self-auto"
        >
          <RotateCcw className="w-4 h-4 text-critical" aria-hidden="true" />
          <span>Reset demo data</span>
        </button>
      </div>

      {errorMessage && (
        <div
          className="p-4 rounded-[6px] bg-critical-bg border border-critical/30 text-critical text-sm"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {/* Counter Cards */}
      <div className="card-box bg-surface space-y-4">
        <h2 className="text-lg font-bold text-ink flex items-center gap-2">
          <Monitor className="w-5 h-5 text-primary" aria-hidden="true" />
          <span>Counters</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {org.counters.map((counter) => {
            const currentCust = org.customers.find(
              (c) => c.id === counter.currentTokenId || c.token === counter.currentTokenId
            );

            // Compute block reasons
            const isServing = counter.status === 'serving';
            const isClosed = counter.status === 'closed';
            const isLastActive = nonClosedCounters.length <= 1 && !isClosed;

            const eligibleWaiting = org.customers.filter(
              (c) => c.status === 'waiting' && counter.serviceIds.includes(c.serviceId)
            );
            const noEligibleTokens = eligibleWaiting.length === 0;

            let closeBlockReason: string | null = null;
            if (isServing) {
              closeBlockReason = `Cannot close while serving ${currentCust?.token || 'active token'}. Complete the service first.`;
            } else if (isLastActive) {
              closeBlockReason = 'Cannot close the last active counter.';
            }

            let callNextBlockReason: string | null = null;
            if (isClosed) {
              callNextBlockReason = 'Counter is closed.';
            } else if (isServing) {
              callNextBlockReason = 'Counter is already serving a token.';
            } else if (noEligibleTokens) {
              callNextBlockReason = 'No eligible tokens waiting for this counter.';
            }

            return (
              <div
                key={counter.id}
                className={`p-4 rounded-[6px] border flex flex-col justify-between ${
                  isServing
                    ? 'bg-calm-bg/50 border-calm/40'
                    : isClosed
                    ? 'bg-bg border-border opacity-85'
                    : 'bg-surface border-border'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-ink text-sm">{counter.name}</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-[4px] border uppercase text-[11px] ${
                        isServing
                          ? 'bg-calm-bg text-calm border-calm/30'
                          : isClosed
                          ? 'bg-bg text-ink-muted border-border'
                          : 'bg-bg text-primary border-primary/30'
                      }`}
                    >
                      {counter.status}
                    </span>
                  </div>

                  <div className="text-xs text-ink-muted mb-1">Current token</div>
                  <div className="font-mono text-xl font-bold text-ink mb-3">
                    {currentCust ? currentCust.token : 'None'}
                  </div>

                  {currentCust && (
                    <div className="text-xs text-ink-muted mb-3">
                      <div>Customer: {currentCust.name}</div>
                      <div>Status: {currentCust.status}</div>
                    </div>
                  )}

                  <div className="text-[11px] text-ink-muted mb-4">
                    Services: {counter.serviceIds.join(', ')}
                  </div>
                </div>

                {/* State actions */}
                <div className="space-y-2 pt-2 border-t border-border">
                  {/* Action depending on state */}
                  {!isClosed && !isServing && (
                    <div>
                      <button
                        type="button"
                        disabled={!!callNextBlockReason}
                        onClick={() =>
                          handleAction({
                            type: 'callNext',
                            orgId: org.id,
                            counterId: counter.id,
                          })
                        }
                        className="btn-primary w-full text-xs"
                      >
                        Call next
                      </button>
                      {callNextBlockReason && (
                        <p className="text-[11px] text-ink-muted mt-1">{callNextBlockReason}</p>
                      )}
                    </div>
                  )}

                  {isServing && currentCust?.status === 'called' && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleAction({
                            type: 'startService',
                            orgId: org.id,
                            counterId: counter.id,
                          })
                        }
                        className="btn-primary w-full text-xs"
                      >
                        Start service
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleAction({
                            type: 'markMissed',
                            orgId: org.id,
                            counterId: counter.id,
                          })
                        }
                        className="btn-secondary w-full text-xs text-critical"
                      >
                        Mark missed
                      </button>
                    </div>
                  )}

                  {isServing && currentCust?.status === 'serving' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction({
                          type: 'completeService',
                          orgId: org.id,
                          counterId: counter.id,
                        })
                      }
                      className="btn-primary w-full text-xs"
                    >
                      Complete
                    </button>
                  )}

                  {/* Open / Close Buttons */}
                  {isClosed ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction({
                          type: 'openCounter',
                          orgId: org.id,
                          counterId: counter.id,
                        })
                      }
                      className="btn-secondary w-full text-xs"
                    >
                      Open
                    </button>
                  ) : (
                    <div>
                      <button
                        type="button"
                        disabled={!!closeBlockReason}
                        onClick={() =>
                          handleAction({
                            type: 'closeCounter',
                            orgId: org.id,
                            counterId: counter.id,
                          })
                        }
                        className="btn-danger w-full text-xs"
                      >
                        Close
                      </button>
                      {closeBlockReason && (
                        <p className="text-[11px] text-critical mt-1 leading-snug">
                          {closeBlockReason}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Waiting List Table */}
      <div className="card-box bg-surface space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-bold text-ink">Waiting list</h2>
          <span className="text-xs text-ink-muted">{waitingCustomers.length} waiting</span>
        </div>

        {waitingCustomers.length === 0 ? (
          <p className="text-sm text-ink-muted py-4">No customers waiting right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg text-xs font-semibold text-ink-muted border-b border-border">
                <tr>
                  <th className="p-3">Token</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Service</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Joined</th>
                  <th className="p-3">Est. wait</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {waitingCustomers.map((cust) => {
                  const service = org.services.find((s) => s.id === cust.serviceId);
                  const rank = getTierRank(cust);
                  const tierLabel = rank === 0 ? 'Accessibility' : rank === 1 ? 'Appointment' : 'Walk-in';

                  return (
                    <tr key={cust.id} className="hover:bg-bg/50">
                      <td className="p-3 font-mono font-bold text-primary">{cust.token}</td>
                      <td className="p-3 text-ink font-medium">{cust.name}</td>
                      <td className="p-3 text-ink-muted">{service?.name || cust.serviceId}</td>
                      <td className="p-3 text-xs">{tierLabel}</td>
                      <td className="p-3 text-xs font-mono text-ink-muted">
                        {formatTime(cust.joinedAt)}
                      </td>
                      <td className="p-3 font-mono text-ink">
                        {cust.estimatedWaitMinutes !== null
                          ? `${cust.estimatedWaitMinutes} min`
                          : 'Waiting'}
                      </td>
                      <td className="p-3 text-xs">
                        {cust.priority === 'pending' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleAction({
                                  type: 'approvePriority',
                                  orgId: org.id,
                                  tokenId: cust.token,
                                })
                              }
                              className="text-xs font-semibold text-calm hover:underline cursor-pointer"
                            >
                              Approve
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleAction({
                                  type: 'rejectPriority',
                                  orgId: org.id,
                                  tokenId: cust.token,
                                })
                              }
                              className="text-xs font-semibold text-critical hover:underline cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : cust.priority === 'approved' ? (
                          <span className="text-calm font-medium">Approved</span>
                        ) : (
                          <span className="text-ink-muted">None</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleAction({
                              type: 'skip',
                              orgId: org.id,
                              tokenId: cust.token,
                            })
                          }
                          className="text-xs text-ink-muted hover:text-ink underline cursor-pointer"
                        >
                          Skip
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Missed List */}
      <div className="card-box bg-surface space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-lg font-bold text-ink">Missed turns</h2>
          <span className="text-xs text-ink-muted">{missedCustomers.length} recorded</span>
        </div>

        {missedCustomers.length === 0 ? (
          <p className="text-sm text-ink-muted py-2">No missed customers.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg text-xs font-semibold text-ink-muted border-b border-border">
                <tr>
                  <th className="p-3">Token</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Missed time</th>
                  <th className="p-3">Grace left</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {missedCustomers.map((cust) => {
                  const graceMs = org.settings.graceMinutes * 60000;
                  const elapsedMs = cust.missedAt ? now - cust.missedAt : 0;
                  const remainingMs = Math.max(0, graceMs - elapsedMs);
                  const remainingMin = Math.ceil(remainingMs / 60000);

                  // Find available compatible counter for recall
                  const recallCounter = org.counters.find(
                    (c) => c.status === 'available' && c.serviceIds.includes(cust.serviceId)
                  );

                  return (
                    <tr key={cust.id} className="hover:bg-bg/50">
                      <td className="p-3 font-mono font-bold text-critical">{cust.token}</td>
                      <td className="p-3 text-ink font-medium">{cust.name}</td>
                      <td className="p-3 text-xs font-mono text-ink-muted">
                        {cust.missedAt ? formatTime(cust.missedAt) : 'None'}
                      </td>
                      <td className="p-3 text-xs font-mono">
                        {remainingMin > 0 ? `${remainingMin} min left` : 'Grace period ended'}
                      </td>
                      <td className="p-3 text-right space-x-3">
                        <button
                          type="button"
                          disabled={!recallCounter}
                          onClick={() =>
                            recallCounter &&
                            handleAction({
                              type: 'recallMissed',
                              orgId: org.id,
                              tokenId: cust.token,
                              counterId: recallCounter.id,
                            })
                          }
                          className="text-xs font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
                        >
                          Recall {recallCounter ? `to ${recallCounter.name}` : '(No counter)'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleAction({
                              type: 'returnMissedToQueue',
                              orgId: org.id,
                              tokenId: cust.token,
                            })
                          }
                          className="text-xs font-semibold text-ink-muted hover:text-ink underline cursor-pointer"
                        >
                          Return to queue
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recommendations & Notifications side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recommendations */}
        <div className="card-box bg-surface space-y-4">
          <h2 className="text-base font-bold text-ink flex items-center gap-2 border-b border-border pb-3">
            <Cpu className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>AutoCounter recommendations</span>
          </h2>

          {recommendations.length === 0 ? (
            <p className="text-sm text-ink-muted py-2">No active recommendations.</p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="p-3 rounded-[6px] bg-bg border border-border text-sm space-y-1">
                  <div className="font-semibold text-xs text-primary uppercase tracking-wider">
                    {rec.type.replace('_', ' ')}
                  </div>
                  <p className="text-ink leading-relaxed">{rec.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications panel */}
        <div className="card-box bg-surface space-y-4">
          <h2 className="text-base font-bold text-ink flex items-center gap-2 border-b border-border pb-3">
            <Bell className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>Recent alerts</span>
          </h2>

          {org.notifications.length === 0 ? (
            <p className="text-sm text-ink-muted py-2">No notifications yet.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {org.notifications.slice(0, 15).map((notif) => (
                <div
                  key={notif.id}
                  className="p-3 rounded-[6px] bg-bg border border-border text-sm flex items-start justify-between gap-3"
                >
                  <p className="text-ink leading-relaxed flex-1">{notif.message}</p>
                  <span className="text-xs text-ink-muted font-mono whitespace-nowrap">
                    {formatTime(notif.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
        >
          <div className="bg-surface border border-border rounded-[8px] p-6 max-w-sm w-full space-y-4">
            <h3 id="reset-title" className="text-lg font-bold text-ink">
              Reset demo data?
            </h3>
            <p className="text-sm text-ink-muted">
              This will restore all organisations, sample customers, and counters to the initial seeded state.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetDialog(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetDemo();
                  setShowResetDialog(false);
                }}
                className="btn-danger"
              >
                Reset demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
