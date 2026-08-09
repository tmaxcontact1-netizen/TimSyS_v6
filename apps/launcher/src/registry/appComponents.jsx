import React, { lazy, Suspense } from 'react';

const LoadingFallback = () => (
  <div className="min-h-screen bg-timsys-dark flex items-center justify-center">
    <div className="spinner"></div>
  </div>
);

const wrap = (Component) => (
  <Suspense fallback={<LoadingFallback />}>
    <Component />
  </Suspense>
);

// Lazy-load app-specific dashboards
const PrincipalEdDashboard = lazy(() => import('../../../principaled/src/dashboard/Index'));

// MeMeCoinEd not built yet — falls back to "not configured"

const registry = {
  principaled: {
    component: PrincipalEdDashboard,
    title: "Principal'Ed",
    navItems: [
      { id: 'overview', label: 'Overview' },
      { id: 'students', label: 'Students' },
      { id: 'staff', label: 'Staff' },
      { id: 'attendance', label: 'Attendance' },
      { id: 'notifications', label: 'Notifications' },
    ],
  },
};

export const getAppComponent = (appId) => {
  const entry = registry[appId];
  if (!entry) return null;
  return wrap(entry.component);
};

export const getAppConfig = (appId) => {
  return registry[appId] || null;
};

export const isAppRegistered = (appId) => {
  return !!registry[appId];
};

export default registry;
