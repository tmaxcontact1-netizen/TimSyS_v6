import React from 'react';

function AppSelector({ apps, onSelect }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {apps.map((app) => (
        <div
          key={app.appId}
          onClick={() => onSelect(app.appId)}
          className="bg-gray-900 border border-gray-800 rounded-lg p-6 cursor-pointer hover:border-timsys-primary hover:bg-gray-800 transition-all"
        >
          <h3 className="text-xl font-bold text-white mb-2">{app.displayName}</h3>
          <p className="text-gray-400 text-sm mb-4">{app.description}</p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">v{app.version}</span>
            <span className="text-timsys-primary text-sm">→</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AppSelector;