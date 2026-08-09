import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAppConfig, isAppRegistered } from '../registry/appComponents';
import ModulePortalPage from './ModulePortalPage';

const appDashboards = {
  principaled: React.lazy(() => import('../../../principaled/src/dashboard/Index')),
};

function AppDashboard() {
  const { appId } = useParams();
  const navigate = useNavigate();

  if (!isAppRegistered(appId)) {
    return (
      <div className="min-h-screen bg-timsys-dark flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">App Not Configured</h1>
          <p className="text-gray-400 mb-6">
            "{appId}" doesn't have a dashboard component yet.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-timsys-primary hover:bg-timsys-secondary text-white px-6 py-2 rounded"
          >
            ← Back to App Selection
          </button>
        </div>
      </div>
    );
  }

  const config = getAppConfig(appId);
  const DashboardComponent = appDashboards[appId];

  if (!DashboardComponent) {
    return (
      <div className="min-h-screen bg-timsys-dark flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Coming Soon</h1>
          <p className="text-gray-400 mb-6">
            "{config?.title || appId}" dashboard is not built yet.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-timsys-primary hover:bg-timsys-secondary text-white px-6 py-2 rounded"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-timsys-dark">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white text-sm"
            >
              ← Launcher
            </button>
            <span className="text-gray-600">|</span>
            <h1 className="text-lg font-bold text-timsys-primary">
              {config?.title || appId}
            </h1>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <React.Suspense fallback={<div className="spinner"></div>}>
          <DashboardComponent appId={appId} />
        </React.Suspense>
      </main>
    </div>
  );
}

export default AppDashboard;
