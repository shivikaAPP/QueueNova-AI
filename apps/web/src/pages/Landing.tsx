import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Activity, ShieldCheck, Cpu, ArrowRight } from 'lucide-react';
import { useQueueStore } from '../store/queueStore.js';
import { getPulse } from '@queuenova/queue-engine';

export const Landing: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const { appState, selectedOrgId } = useQueueStore();
  const org = appState.orgs[selectedOrgId] || Object.values(appState.orgs)[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  const primaryService = org?.services[0];
  const pulse = mounted && org && primaryService ? getPulse(org, primaryService.id, Date.now()) : null;

  const servingCounter = org?.counters.find((c) => c.status === 'serving' && c.serviceIds.includes(primaryService?.id || ''));
  const servingCustomer = servingCounter
    ? org.customers.find((c) => c.id === servingCounter.currentTokenId || c.token === servingCounter.currentTokenId)
    : null;

  return (
    <div className="flex flex-col gap-16 py-12">
      {/* 1. Hero Section */}
      <section className="max-w-[1120px] mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-ink">
              Know your wait before you join the line
            </h1>
            <p className="text-lg sm:text-xl text-ink-muted leading-relaxed">
              QueueNova gives each visitor a digital token, a live estimate of their wait, and a time to come back. Staff see which queues are filling up and which counters to open.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/join" className="btn-primary">
                Join a queue
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link to="/admin" className="btn-secondary">
                Open admin demo
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="card-box bg-surface shadow-none border border-border">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div>
                  <h3 className="text-base font-semibold text-ink">
                    {primaryService ? primaryService.name : 'Service queue preview'}
                  </h3>
                  <p className="text-xs text-ink-muted">{org ? org.name : 'Demo organisation'}</p>
                </div>
                {mounted && pulse && (
                  <span
                    className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-[4px] border ${
                      pulse.level === 'calm'
                        ? 'bg-calm-bg text-calm border-calm/30'
                        : pulse.level === 'busy'
                        ? 'bg-busy-bg text-busy border-busy/30'
                        : 'bg-critical-bg text-critical border-critical/30'
                    }`}
                  >
                    {pulse.level.charAt(0).toUpperCase() + pulse.level.slice(1)}
                  </span>
                )}
              </div>

              {!mounted ? (
                <div className="py-8 text-center text-sm text-ink-muted">
                  Loading queue data
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-bg p-3 rounded-[6px] border border-border">
                      <div className="text-xs text-ink-muted mb-1">Now serving</div>
                      <div className="font-mono text-xl font-semibold text-ink">
                        {servingCustomer ? servingCustomer.token : 'None'}
                      </div>
                      <div className="text-xs text-ink-muted mt-1">
                        {servingCounter ? servingCounter.name : 'No active counter'}
                      </div>
                    </div>

                    <div className="bg-bg p-3 rounded-[6px] border border-border">
                      <div className="text-xs text-ink-muted mb-1">People waiting</div>
                      <div className="font-mono text-xl font-semibold text-ink">
                        {pulse ? pulse.waiting : 0}
                      </div>
                      <div className="text-xs text-ink-muted mt-1">
                        Est. wait: {pulse?.newArrivalEta !== null ? `${pulse?.newArrivalEta} min` : 'No counter open'}
                      </div>
                    </div>
                  </div>

                  {pulse && (
                    <div className="text-xs text-ink-muted bg-bg p-3 rounded-[6px] border border-border">
                      {pulse.reason}
                    </div>
                  )}

                  <div className="pt-1">
                    <p className="text-xs text-ink-muted text-center">
                      Demo data. Resets when staff reset the demo.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. How it works (NovaFlow) */}
      <section className="bg-surface border-y border-border py-12">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              How it works
            </h2>
            <p className="text-ink-muted mt-1">NovaFlow: Predict, Prevent, Recover.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border border-border rounded-[8px] p-6 bg-bg">
              <div className="text-sm font-semibold uppercase tracking-wider text-primary mb-2">
                Predict
              </div>
              <p className="text-ink leading-relaxed">
                Each token shows people ahead, estimated wait and a return window, recalculated whenever the queue changes.
              </p>
            </div>

            <div className="border border-border rounded-[8px] p-6 bg-bg">
              <div className="text-sm font-semibold uppercase tracking-wider text-primary mb-2">
                Prevent
              </div>
              <p className="text-ink leading-relaxed">
                QueuePulse flags a queue as Calm, Busy or Critical. AutoCounter suggests opening a counter and says why.
              </p>
            </div>

            <div className="border border-border rounded-[8px] p-6 bg-bg">
              <div className="text-sm font-semibold uppercase tracking-wider text-primary mb-2">
                Recover
              </div>
              <p className="text-ink leading-relaxed">
                If a counter closes or a visitor misses their turn, estimates update and affected visitors are notified in the app.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. What you get */}
      <section className="max-w-[1120px] mx-auto px-4 sm:px-6 w-full">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            What you get
          </h2>
          <p className="text-ink-muted mt-1">Core features of the QueueNova prototype.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card-box bg-surface flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-[6px] bg-bg border border-border flex items-center justify-center text-primary mb-4">
                <Ticket className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">SmartWait Pass</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Digital queue token showing live wait estimates, return windows, and in-app notifications.
              </p>
            </div>
          </div>

          <div className="card-box bg-surface flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-[6px] bg-bg border border-border flex items-center justify-center text-primary mb-4">
                <Activity className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">QueuePulse</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Real-time queue load tracking that classifies pressure as Calm, Busy, or Critical.
              </p>
            </div>
          </div>

          <div className="card-box bg-surface flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-[6px] bg-bg border border-border flex items-center justify-center text-primary mb-4">
                <Cpu className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">AutoCounter</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Rule-based counter recommendations that suggest opening, closing, or reassigning desks.
              </p>
            </div>
          </div>

          <div className="card-box bg-surface flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-[6px] bg-bg border border-border flex items-center justify-center text-primary mb-4">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">FairTurn</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Fair queue ordering protecting accessibility requests and valid appointment slots.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Limits, stated plainly */}
      <section className="max-w-[1120px] mx-auto px-4 sm:px-6 w-full">
        <div className="border border-border rounded-[8px] bg-surface p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-ink mb-2">Limits, stated plainly</h3>
          <p className="text-base text-ink leading-relaxed">
            This is a prototype. Data is sample data stored in your browser. Notifications appear inside the app only. Wait times are estimates.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Landing;
