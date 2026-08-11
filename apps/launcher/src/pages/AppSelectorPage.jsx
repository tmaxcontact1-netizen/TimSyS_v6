import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useAppStore from '../store/appStore';

function AppSelectorPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { apps } = useAppStore();

  const handleAppClick = (appId) => {
    navigate(`/login/${appId}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-timsys-dark">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-timsys-primary">TimSyS Launcher</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user?.username || 'User'}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm">Logout</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-white mb-2">Select an Application</h2>
        <p className="text-gray-400 mb-8">Choose an app to continue.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => (
            <button
              key={app.appId}
              onClick={() => handleAppClick(app.appId)}
              className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-left hover:border-timsys-primary hover:bg-gray-850 transition-colors"
            >
              <h3 className="text-xl font-bold text-white mb-2">{app.displayName}</h3>
              <p className="text-gray-400 text-sm">{app.description}</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

export default AppSelectorPage;
