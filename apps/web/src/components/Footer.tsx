import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-surface border-t border-border mt-auto py-8">
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-muted">
        <nav className="flex items-center gap-6" aria-label="Footer navigation">
          <Link to="/terms" className="hover:text-ink transition-colors">
            Terms and conditions
          </Link>
          <Link to="/privacy" className="hover:text-ink transition-colors">
            Privacy policy
          </Link>
          <Link to="/live" className="hover:text-ink transition-colors">
            Live queue status
          </Link>
        </nav>
        <div>
          QueueNova, 2026. Prototype with sample data.
        </div>
      </div>
    </footer>
  );
};
