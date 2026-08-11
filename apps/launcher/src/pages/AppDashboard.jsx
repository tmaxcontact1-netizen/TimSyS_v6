import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PrincipalEdPage from './PrincipalEdPage';
import useAppStore from '../store/appStore';

function AppDashboard() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const { getApp } = useAppStore();
  const [iframeError, setIframeError] = useState(false);
  const [loading, setLoading] = useState(true);

  const app = getApp(appId);

  useEffect(() => {
    if (app?.url) {
      setLoading(true);
      setIframeError(false);
      const timer = setTimeout(() => setLoading(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [appId]);

  if (appId === 'principal-ed') {
    return <PrincipalEdPage />;
  }

  if (app?.url) {
    return (
      <div className="h-screen bg-timsys-dark flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white text-sm"
          >
            ← Back to Launcher
          </button>
          <span className="text-white text-sm font-medium">{app.displayName}</span>
          <div />
        </div>
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-timsys-dark">
              <div className="text-center">
                <div className="spinner mx-auto mb-4" />
                <p className="text-gray-400 text-sm">Connecting to {app.displayName}...</p>
                <p className="text-gray-600 text-xs mt-2">{app.url}</p>
              </div>
            </div>
          )}
          <iframe
            src={app.url}
            className="w-full h-full border-0"
            onLoad={() => setLoading(false)}
            onError={() => setIframeError(true)}
            title={app.displayName}
          />
          {iframeError && (
            <div className="absolute inset-0 flex items-center justify-center bg-timsys-dark">
              <div className="text-center">
                <p className="text-red-400 mb-2">Failed to connect to {app.displayName}</p>
                <p className="text-gray-500 text-sm mb-4">Make sure the app is running at {app.url}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="bg-timsys-primary text-white px-4 py-2 rounded text-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-timsys-dark flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl text-white mb-4">{app?.displayName || appId} not yet implemented</h1>
        <button
          onClick={() => navigate('/')}
          className="bg-timsys-primary text-white px-6 py-2 rounded"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

export default AppDashboard;
