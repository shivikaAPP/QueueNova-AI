import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Cpu,
  Server,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

export const Loading: React.FC = () => {
  const navigate = useNavigate();
  const {
    isLoading,
    loadingProgress,
    loadingStepText,
    startLoading,
    skipLoading,
    resetLoading,
  } = useAuthStore();

  useEffect(() => {
    // Automatically trigger loading sequence on mount
    resetLoading();
    startLoading(() => {
      // Small pause after 100% before transition
      const timer = setTimeout(() => {
        navigate('/login');
      }, 350);
      return () => clearTimeout(timer);
    });
  }, [navigate, resetLoading, startLoading]);

  const handleSkip = () => {
    skipLoading();
    navigate('/login');
  };

  const steps = [
    {
      label: 'Initialize queue state engine',
      threshold: 25,
      icon: Cpu,
    },
    {
      label: 'Connect to real-time counter stations',
      threshold: 50,
      icon: Server,
    },
    {
      label: 'Verify security rules and session policy',
      threshold: 75,
      icon: ShieldCheck,
    },
    {
      label: 'Prepare live operational dashboard',
      threshold: 100,
      icon: Clock,
    },
  ];

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-[540px] card-box bg-surface border border-border shadow-none space-y-6">
        {/* Brand identity header */}
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <svg
            className="w-10 h-10 rounded-[6px] shrink-0"
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
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg text-ink">QueueNova</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-[4px] border border-border text-ink-muted bg-bg select-none">
                Demo data
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Digital tokens and live wait estimates
            </p>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Loading QueueNova
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Setting up queue operations and real-time state listeners.
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>{loadingStepText}</span>
            </span>
            <span className="font-mono font-semibold text-primary">
              {loadingProgress}%
            </span>
          </div>

          <div
            className="w-full h-3 bg-bg rounded-[6px] border border-border overflow-hidden"
            role="progressbar"
            aria-valuenow={loadingProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="System loading progress"
          >
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>

        {/* System Checklist */}
        <div className="space-y-2.5 pt-2">
          {steps.map((step, idx) => {
            const isDone = loadingProgress >= step.threshold;
            const Icon = step.icon;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-2.5 rounded-[6px] border text-xs transition-colors ${
                  isDone
                    ? 'bg-calm-bg/50 border-calm/30 text-ink'
                    : 'bg-bg border-border text-ink-muted'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isDone ? 'text-calm' : 'text-ink-muted'
                    }`}
                    aria-hidden="true"
                  />
                  <span className={isDone ? 'font-medium' : ''}>
                    {step.label}
                  </span>
                </div>
                {isDone ? (
                  <CheckCircle2
                    className="w-4 h-4 text-calm shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="font-mono text-[11px] text-ink-muted">
                    Pending
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => {
              resetLoading();
              startLoading(() => {
                setTimeout(() => navigate('/login'), 350);
              });
            }}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Restart loading</span>
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="btn-primary text-sm py-2 px-4"
          >
            <span>Continue to login</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Loading;
