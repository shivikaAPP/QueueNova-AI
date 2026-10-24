import React from 'react';
import { Link } from 'react-router-dom';

export const NotFound: React.FC = () => {
  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-16 flex-1 flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-ink">
        Page not found
      </h1>
      <p className="text-lg text-ink-muted mb-8 max-w-md">
        The page you asked for does not exist or has moved.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link to="/" className="btn-primary">
          Home
        </Link>
        <Link to="/join" className="btn-secondary">
          Join a queue
        </Link>
        <Link to="/live" className="btn-secondary">
          Live queue status
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
