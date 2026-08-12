import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PrincipalEdPage from './PrincipalEdPage';
import ModulePortalPage from './ModulePortalPage';
import useAppStore from '../store/appStore';

function AppDashboard() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const app = useAppStore((state) => state.getApp(appId));
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!app?.supervised) return undefined;
    const api = window.electronAPI?.supervisedApp;
    if (!api) {
      setError('Independent application launching is available in the TimSyS desktop launcher.');
      return undefined;
    }
    let active = true;
    const unsubscribe = api.onStatusChanged((next) => {
      if (active && next.id === appId) setStatus(next);
    });
    api.status(appId)
      .then((next) => active && setStatus(next))
      .catch((cause) => active && setError(cause.message));
    return () => { active = false; unsubscribe(); };
  }, [appId, app?.supervised]);

  const startAndOpen = async () => {
    const api = window.electronAPI?.supervisedApp;
    if (!api) return;
    setError(null);
    try {
      let next = await api.status(appId);
      if (next.state === 'degraded' || next.state === 'failed') next = await api.stop(appId);
      if (next.state !== 'running') next = await api.start(appId);
      setStatus(next);
      await api.open(appId);
    } catch (cause) {
      setError(cause.message);
    }
  };

  const stop = async () => {
    setError(null);
    try {
      setStatus(await window.electronAPI.supervisedApp.stop(appId));
    } catch (cause) {
      setError(cause.message);
    }
  };

  if (appId === 'principal-ed') return <PrincipalEdPage />;
  if (appId === 'builder') return <ModulePortalPage />;

  if (app?.supervised) {
    const state = status?.state || 'stopped';
    const busy = state === 'starting' || state === 'stopping';
    return (
      <div className="min-h-screen bg-timsys-dark flex items-center justify-center">
        <div className="text-center max-w-lg px-6">
          <h1 className="text-2xl text-white mb-2">{app.displayName}</h1>
          <p className="text-gray-400 mb-2">Runs independently under launcher supervision.</p>
          <p className="text-sm text-gray-500 mb-6">Status: {state}</p>
          {status?.detail && <p className="text-amber-400 text-sm mb-4">{status.detail}</p>}
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <div className="flex justify-center gap-3">
            <button onClick={() => navigate('/')} className="bg-gray-700 text-white px-5 py-2 rounded">Back</button>
            {state === 'running' ? (
              <>
                <button onClick={() => window.electronAPI.supervisedApp.open(appId)} className="bg-timsys-primary text-white px-5 py-2 rounded">Open</button>
                <button onClick={stop} className="bg-red-700 text-white px-5 py-2 rounded">Stop</button>
              </>
            ) : (
              <button disabled={busy || !window.electronAPI} onClick={startAndOpen} className="bg-timsys-primary disabled:opacity-50 text-white px-5 py-2 rounded">
                {busy ? 'Starting…' : state === 'configuration_required' ? 'Open setup' : 'Start and open'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-timsys-dark flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl text-white mb-4">{app?.displayName || appId} not yet implemented</h1>
        <button onClick={() => navigate('/')} className="bg-timsys-primary text-white px-6 py-2 rounded">Back</button>
      </div>
    </div>
  );
}

export default AppDashboard;
