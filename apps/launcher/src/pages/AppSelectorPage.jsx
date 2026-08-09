import { useAnyPermission } from '../utils/permissions';
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import apiClient from '../api/base';

function AppSelectorPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const showBuilder = useAnyPermission(['admin:*', 'admin:builder:access']);
  const [localApps, setLocalApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const response = await apiClient.get('/apps');
        const appsArray = response.data?.data || [];
        setLocalApps(Array.isArray(appsArray) ? appsArray : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchApps();
  }, []);

  const handleAppClick = (appId) => {
    navigate(`/app/${appId}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const allApps = Array.isArray(localApps) ? localApps : [];

  return (
    <div className="min-h-screen bg-timsys-dark">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-timsys-primary">TimSyS</h1>
          <div className="flex items-center gap-4">

            {showBuilder && (
              <button
                onClick={() => navigate('/modules')}
                className="text-gray-400 hover:text-white text-sm"
              >
                Module Selector
              </button>
            )}
            <span className="text-gray-400 text-sm">
              {user?.username || 'User'}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-white mb-2">Select an Application</h2>
        <p className="text-gray-400 mb-8">Choose an app to continue.</p>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="spinner"></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allApps.map((app) => (
              <button
                key={app.appId || app.app_id || app.id}
                onClick={() => handleAppClick(app.appId || app.app_id || app.id)}
                className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-left hover:border-timsys-primary hover:bg-gray-850 transition-colors group"
              >
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-timsys-primary">
                  {app.displayName || app.display_name || app.appId || app.app_id}
                </h3>
                <p className="text-gray-400 text-sm">{app.description || ''}</p>
              </button>
            ))}
            {allApps.length === 0 && !error && (
              <div className="col-span-full text-center py-12 text-gray-500">
                No apps available.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default AppSelectorPage;
