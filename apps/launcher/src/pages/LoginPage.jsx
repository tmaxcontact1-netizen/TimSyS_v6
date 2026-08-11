import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useAppStore from '../store/appStore';

function LoginPage() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const { apps, selectApp } = useAppStore();

  const selectedApp = apps.find((a) => a.appId === appId);
  const displayName = selectedApp?.displayName || 'TimSyS';

  useEffect(() => {
    selectApp(appId);
  }, [appId]);

  const handleAutoLogin = async () => {
    try {
      await login({ username: 'admin', password: 'any' });
      navigate(`/app/${appId}`);
    } catch (err) {
      // handled
    }
  };

  return (
    <div className="min-h-screen bg-timsys-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-lg shadow-xl p-8 fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-timsys-primary mb-2">{displayName}</h1>
          <p className="text-gray-400">Developer Mode - Auto Login</p>
        </div>

        <button
          onClick={handleAutoLogin}
          disabled={isLoading}
          className="w-full bg-timsys-primary hover:bg-timsys-secondary text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 text-lg"
        >
          {isLoading ? 'Signing in...' : 'Continue as Admin'}
        </button>

        <div className="mt-6 pt-6 border-t border-gray-800 text-center">
          <p className="text-xs text-gray-500">
            Development build — no credentials required
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full text-center text-sm text-gray-500 hover:text-gray-300 mt-6"
        >
          ← Back to app selection
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
