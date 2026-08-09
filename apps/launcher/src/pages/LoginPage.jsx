import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useAppStore from '../store/appStore';

function LoginPage() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { apps, selectApp } = useAppStore();

  const selectedApp = apps.find((a) => a.appId === appId);
  const displayName = selectedApp?.displayName || appId || 'TimSyS';

  const [formData, setFormData] = useState({ username: '', password: '' });

  useEffect(() => {
    return () => clearError();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(formData);
      selectApp(appId);
      navigate(`/app/${appId}`);
    } catch (err) {
      // handled in store
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen bg-timsys-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-lg shadow-xl p-8 fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-timsys-primary mb-2">{displayName}</h1>
          <p className="text-gray-400">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-timsys-primary focus:ring-1 focus:ring-timsys-primary text-white"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-timsys-primary focus:ring-1 focus:ring-timsys-primary text-white"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-timsys-primary hover:bg-timsys-secondary text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

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
