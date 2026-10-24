import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      window.localStorage.removeItem('queuenova.state.v1');
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-[600px] mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-[6px] bg-critical-bg text-critical flex items-center justify-center border border-critical/30">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-ink">
            QueueNova operational view recovered
          </h2>
          <p className="text-sm text-ink-muted">
            A state discrepancy was detected in the active browser session. Resetting the demo queue state will restore normal operations.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="btn-primary text-sm inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reset demo state and reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
