import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import Loading from './pages/Loading.js';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';

const Landing = lazy(() => import('./pages/Landing.js'));
const Join = lazy(() => import('./pages/Join.js'));
const Pass = lazy(() => import('./pages/Pass.js'));
const Live = lazy(() => import('./pages/Live.js'));
const AdminCounters = lazy(() => import('./pages/AdminCounters.js'));
const Terms = lazy(() => import('./pages/Terms.js'));
const Privacy = lazy(() => import('./pages/Privacy.js'));
const NotFound = lazy(() => import('./pages/NotFound.js'));

export const App: React.FC = () => {
  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-12 text-ink-muted">Loading...</div>}>
          <Routes>
            {/* Sequential flow: Loading -> Login -> Dashboard */}
            <Route path="/" element={<Loading />} />
            <Route path="/loading" element={<Loading />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/counters" element={<AdminCounters />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/join" element={<Join />} />
            <Route path="/pass" element={<Pass />} />
            <Route path="/live" element={<Live />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
};

export default App;
