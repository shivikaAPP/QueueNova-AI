import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Clock,
  Users,
  Bell,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useQueueStore, getSecret } from '../store/queueStore.js';
import {
  getPeopleAhead,
  getReturnWindow,
  getConfidence,
  formatTime,
} from '@queuenova/queue-engine';

export const Pass: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('t') || '';

  const [mounted, setMounted] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { appState, dispatch } = useQueueStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const now = mounted ? Date.now() : 0;

  // Locate the customer across all orgs by token
  let targetOrgId: string | null = null;
  let targetCustomer: any = null;

  for (const org of Object.values(appState.orgs)) {
    const cust = org.customers.find((c) => c.token === tokenParam);
    if (cust) {
      targetOrgId = org.id;
      targetCustomer = cust;
      break;
    }
  }

  const org = targetOrgId ? appState.orgs[targetOrgId] : null;
  const service = org && targetCustomer ? org.services.find((s) => s.id === targetCustomer.serviceId) : null;

  if (!mounted) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink mb-4">
          {tokenParam ? `Queue pass ${tokenParam}` : 'Queue pass'}
        </h1>
        <div className="card-box bg-surface text-center py-12 text-ink-muted">
          Loading queue data
        </div>
      </div>
    );
  }

  if (!targetCustomer || !org) {
    return (
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1">
        <div className="max-w-md mx-auto text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Queue pass not found
          </h1>
          <p className="text-base text-ink-muted">
            {tokenParam
              ? `No active queue pass was found for token ${tokenParam}. It may have completed, expired, or been reset.`
              : 'No token parameter was provided.'}
          </p>
          <div className="pt-2">
            <Link to="/join" className="btn-primary">
              Join a queue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const peopleAhead = getPeopleAhead(org, targetCustomer.token);
  const estWait = targetCustomer.estimatedWaitMinutes;
  const returnWindow = getReturnWindow(estWait);
  const confidence = getConfidence(org, targetCustomer.serviceId, now);

  const servingCounter = org.counters.find((c) => c.status === 'serving' && c.serviceIds.includes(targetCustomer.serviceId));
  const servingCust = servingCounter
    ? org.customers.find((c) => c.id === servingCounter.currentTokenId || c.token === servingCounter.currentTokenId)
    : null;

  const tokenNotifications = org.notifications.filter(
    (n) => n.tokenId === targetCustomer.token || n.tokenId === targetCustomer.id
  );

  const handleLeaveQueue = () => {
    setActionError(null);
    const cancelSecret = getSecret(targetCustomer.token) || targetCustomer.cancelSecret;

    const res = dispatch({
      type: 'cancel',
      orgId: org.id,
      tokenId: targetCustomer.token,
      cancelSecret,
    });

    if (res.ok) {
      setShowLeaveDialog(false);
    } else {
      setActionError(res.message);
    }
  };

  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 flex-1">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* H1 per design.md section 3.2 */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-border pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Queue pass {targetCustomer.token}
          </h1>
          <span className="text-xs text-ink-muted">{org.name}</span>
        </div>

        {/* Live region for accessibility announcements */}
        <div className="sr-only" aria-live="polite">
          {tokenNotifications[0] ? tokenNotifications[0].message : `Queue status: ${targetCustomer.status}`}
        </div>

        {actionError && (
          <div className="p-4 rounded-[6px] bg-critical-bg border border-critical/30 text-critical text-sm" role="alert">
            {actionError}
          </div>
        )}

        {/* Main Pass Card */}
        <div className="card-box bg-surface space-y-6">
          {/* 1. Token (large, mono) */}
          <div className="text-center py-4 bg-bg border border-border rounded-[6px]">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
              Your Token Number
            </div>
            <div className="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-primary">
              {targetCustomer.token}
            </div>
            <div className="text-sm text-ink-muted mt-1">{targetCustomer.name}</div>
          </div>

          {/* 2. Service & 3. Status Badge */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <div className="text-xs text-ink-muted uppercase tracking-wider">Service</div>
              <div className="text-lg font-semibold text-ink">
                {service ? service.name : targetCustomer.serviceId}
              </div>
              {targetCustomer.priority === 'approved' && (
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-[4px] bg-calm-bg text-calm font-medium border border-calm/30">
                  Priority approved
                </span>
              )}
              {targetCustomer.priority === 'pending' && (
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-[4px] bg-busy-bg text-busy font-medium border border-busy/30">
                  Priority pending staff check
                </span>
              )}
            </div>

            <span
              className={`text-sm font-semibold px-3 py-1.5 rounded-[6px] border ${
                targetCustomer.status === 'serving'
                  ? 'bg-calm-bg text-calm border-calm/40'
                  : targetCustomer.status === 'called'
                  ? 'bg-busy-bg text-busy border-busy/40'
                  : targetCustomer.status === 'waiting'
                  ? 'bg-bg text-ink border-border'
                  : targetCustomer.status === 'missed'
                  ? 'bg-critical-bg text-critical border-critical/40'
                  : 'bg-bg text-ink-muted border-border'
              }`}
            >
              {targetCustomer.status.toUpperCase()}
            </span>
          </div>

          {targetCustomer.status === 'called' && (
            <div className="p-4 rounded-[6px] bg-busy-bg border border-busy/30 text-busy">
              <div className="font-semibold text-base mb-1">Your token is called!</div>
              <p className="text-sm">
                Please proceed immediately to{' '}
                <strong className="underline">
                  {org.counters.find((c) => c.id === targetCustomer.counterId)?.name || 'the counter'}
                </strong>
                .
              </p>
            </div>
          )}

          {targetCustomer.status === 'missed' && (
            <div className="p-4 rounded-[6px] bg-critical-bg border border-critical/30 text-critical text-sm">
              <div className="font-semibold text-base mb-1">Turn missed</div>
              <p>
                You were called but did not respond. Staff can recall your token during the grace period, or it will be requeued automatically.
              </p>
            </div>
          )}

          {/* 4. People ahead, 5. Estimated wait, 6. Return window */}
          {targetCustomer.status === 'waiting' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-bg p-4 rounded-[6px] border border-border">
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-1">
                  <Users className="w-4 h-4" aria-hidden="true" />
                  <span>People ahead in your service</span>
                </div>
                <div className="font-mono text-2xl font-bold text-ink">
                  {peopleAhead}
                </div>
              </div>

              <div className="bg-bg p-4 rounded-[6px] border border-border">
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-1">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <span>Estimated wait</span>
                </div>
                <div className="font-mono text-2xl font-bold text-ink">
                  {estWait !== null ? `${estWait} min` : 'Waiting'}
                </div>
                {estWait === null && (
                  <div className="text-xs text-busy mt-1">Waiting for an available counter</div>
                )}
              </div>
            </div>
          )}

          {/* 6. Return window */}
          {targetCustomer.status === 'waiting' && returnWindow && (
            <div className="p-4 rounded-[6px] bg-bg border border-border">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-1">
                Suggested return window
              </div>
              <div className="text-base font-semibold text-primary">
                {returnWindow.text}
              </div>
            </div>
          )}

          {/* 7. Confidence label */}
          {targetCustomer.status === 'waiting' && (
            <div className="flex items-center justify-between text-sm py-2 border-t border-border">
              <span className="text-ink-muted">Estimate confidence</span>
              <span className="font-semibold text-ink">
                {confidence === 'stable'
                  ? 'Stable'
                  : confidence === 'changing'
                  ? 'Changing'
                  : 'Not enough data yet'}
              </span>
            </div>
          )}

          {/* 8. Currently serving token and counter */}
          <div className="flex items-center justify-between text-sm py-2 border-t border-border">
            <span className="text-ink-muted">Currently serving at counter</span>
            <span className="font-mono font-medium text-ink">
              {servingCust && servingCounter
                ? `${servingCust.token} at ${servingCounter.name}`
                : 'None currently'}
            </span>
          </div>

          {/* Action button */}
          {['waiting', 'called', 'missed'].includes(targetCustomer.status) && (
            <div className="pt-2 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowLeaveDialog(true)}
                className="text-sm font-semibold text-critical hover:underline cursor-pointer"
              >
                Leave the queue
              </button>
            </div>
          )}
        </div>

        {/* 9. Notifications list (newest first) */}
        <div className="card-box bg-surface space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Bell className="w-4 h-4 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold text-ink">Notifications</h2>
          </div>

          {tokenNotifications.length === 0 ? (
            <p className="text-sm text-ink-muted py-2">No notifications yet for this token.</p>
          ) : (
            <div className="space-y-3">
              {tokenNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className="p-3 rounded-[6px] bg-bg border border-border flex items-start gap-3"
                >
                  <div className="mt-0.5">
                    {notif.kind === 'called' ? (
                      <CheckCircle2 className="w-4 h-4 text-busy" aria-hidden="true" />
                    ) : notif.kind === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-calm" aria-hidden="true" />
                    ) : notif.kind === 'missed' ? (
                      <AlertTriangle className="w-4 h-4 text-critical" aria-hidden="true" />
                    ) : (
                      <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 text-sm text-ink leading-relaxed">
                    <p>{notif.message}</p>
                    <span className="text-xs text-ink-muted mt-1 block">
                      {formatTime(notif.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leave Queue Confirmation Dialog */}
      {showLeaveDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <div className="bg-surface border border-border rounded-[8px] p-6 max-w-sm w-full space-y-4">
            <h3 id="dialog-title" className="text-lg font-bold text-ink">
              Leave the queue?
            </h3>
            <p className="text-sm text-ink-muted">
              Are you sure you want to cancel token <strong>{targetCustomer.token}</strong>? You will lose your place in line.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLeaveDialog(false)}
                className="btn-secondary"
              >
                Keep my place
              </button>
              <button
                type="button"
                onClick={handleLeaveQueue}
                className="btn-danger"
              >
                Yes, leave queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pass;
