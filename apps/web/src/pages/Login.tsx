import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('admin@queuenova.com');
  const [password, setPassword] = useState('demo-password-2026');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your work email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);

    // Simulate brief authentication verification
    setTimeout(() => {
      const success = login(email, password);
      setIsSubmitting(false);

      if (success) {
        navigate('/dashboard');
      } else {
        setErrorMessage('Authentication failed. Please verify credentials.');
      }
    }, 250);
  };

  const handleQuickDemoLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('demo-password-2026');
    setErrorMessage(null);
    setIsSubmitting(true);

    setTimeout(() => {
      login(roleEmail, 'demo-password-2026');
      setIsSubmitting(false);
      navigate('/dashboard');
    }, 200);
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-[480px] card-box bg-surface border border-border shadow-none space-y-6">
        {/* Header branding */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
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
                Staff and operator portal
              </p>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Staff and admin sign in
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Access real-time queue controls, counter stations, and token workflows.
          </p>
        </div>

        {errorMessage && (
          <div
            className="p-3 rounded-[6px] bg-critical-bg border border-critical/30 text-critical text-xs flex items-center gap-2 font-medium"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5"
            >
              Work email address
            </label>
            <div className="relative">
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organisation.com"
                className="input-field pl-10"
                autoComplete="email"
              />
              <Mail
                className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-ink uppercase tracking-wider"
              >
                Password
              </label>
              <span className="text-xs text-ink-muted font-normal">
                Demo accepts any value
              </span>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="input-field pl-10 pr-10"
                autoComplete="current-password"
              />
              <Lock
                className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-primary justify-center mt-2"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign in to dashboard</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials Box */}
        <div className="p-3.5 rounded-[6px] bg-bg border border-border space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <KeyRound className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>One-click demo profiles:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('admin@queuenova.com')}
              className="text-left p-2 rounded-[6px] border border-border bg-surface hover:border-primary text-xs transition-colors"
            >
              <div className="font-semibold text-ink">Admin Officer</div>
              <div className="font-mono text-[11px] text-ink-muted">
                admin@queuenova.com
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('staff@queuenova.com')}
              className="text-left p-2 rounded-[6px] border border-border bg-surface hover:border-primary text-xs transition-colors"
            >
              <div className="font-semibold text-ink">Counter Staff</div>
              <div className="font-mono text-[11px] text-ink-muted">
                staff@queuenova.com
              </div>
            </button>
          </div>
        </div>

        {/* Replay loading or navigate to public pages */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-ink-muted">
          <Link
            to="/loading"
            className="inline-flex items-center gap-1.5 hover:text-ink font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Replay loading screen</span>
          </Link>

          <Link
            to="/live"
            className="hover:text-primary font-medium hover:underline"
          >
            View public queue display
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
