import React, { useState, useEffect } from 'react';

function ModuleStatusWidget({ moduleName }) {
  const [moduleData, setModuleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchModule();
  }, [moduleName]);

  const fetchModule = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jwt_token');
      const response = await fetch('/api/modules', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const mod = (data.data || []).find(m => m.name === moduleName);
      setModuleData(mod || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="spinner"></div></div>;
  }

  if (error) {
    return <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">{error}</div>;
  }

  if (!moduleData) {
    return <div className="text-gray-500 text-center py-8">Module '{moduleName}' not found</div>;
  }

  // Count critical info for dev
  const routeCount = moduleData.routes?.length || 0;
  const funcCount = moduleData.functions?.length || 0;
  const depCount = moduleData.dependencies?.length || 0;
  const tableCount = moduleData.schema?.tables?.length || 0;
  const authRoutes = (moduleData.routes || []).filter(r => r.auth_required).length;
  const pubRoutes = routeCount - authRoutes;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">{moduleData.name}</h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-500 text-xs uppercase">Version</p>
          <p className="text-white text-lg font-semibold">{moduleData.version}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-500 text-xs uppercase">Routes</p>
          <p className="text-white text-lg font-semibold">{routeCount}</p>
          <p className="text-gray-500 text-xs">{authRoutes} auth, {pubRoutes} public</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-500 text-xs uppercase">Functions</p>
          <p className="text-white text-lg font-semibold">{funcCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-500 text-xs uppercase">Dependencies</p>
          <p className="text-white text-lg font-semibold">{depCount}</p>
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span className={`px-3 py-1 rounded text-sm font-semibold ${
          moduleData.enabled ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
        }`}>
          {moduleData.enabled ? '● ENABLED' : '○ DISABLED'}
        </span>
      </div>

      {/* Dependencies */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Dependencies ({depCount})</h4>
        {depCount > 0 ? (
          <div className="flex flex-wrap gap-2">
            {moduleData.dependencies.map(dep => (
              <span key={dep} className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">{dep}</span>
            ))}
          </div>
        ) : <p className="text-xs text-gray-600">None</p>}
      </div>

      {/* Routes */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-purple-400 mb-3">Routes ({routeCount})</h4>
        {routeCount > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-1 pr-4">Method</th>
                  <th className="text-left py-1 pr-4">Path</th>
                  <th className="text-left py-1 pr-4">Handler</th>
                  <th className="text-left py-1 pr-4">Auth</th>
                  <th className="text-left py-1">Perms</th>
                </tr>
              </thead>
              <tbody>
                {moduleData.routes.map((route, idx) => (
                  <tr key={idx} className="border-b border-gray-800/50">
                    <td className="py-1 pr-4">
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${
                        route.method === 'GET' ? 'bg-green-900/50 text-green-300' :
                        route.method === 'POST' ? 'bg-blue-900/50 text-blue-300' :
                        route.method === 'PUT' ? 'bg-yellow-900/50 text-yellow-300' :
                        route.method === 'DELETE' ? 'bg-red-900/50 text-red-300' :
                        route.method === 'PATCH' ? 'bg-orange-900/50 text-orange-300' :
                        'bg-gray-800 text-gray-300'
                      }`}>{route.method}</span>
                    </td>
                    <td className="py-1 pr-4 text-gray-300 font-mono">{route.path}</td>
                    <td className="py-1 pr-4 text-gray-400">{route.handler}</td>
                    <td className="py-1 pr-4">
                      {route.auth_required ? <span className="text-red-300">Yes</span> : <span className="text-gray-600">No</span>}
                    </td>
                    <td className="py-1 text-gray-500">
                      {(route.permissions || []).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-gray-600">No routes defined</p>}
      </div>

      {/* Functions */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-400 mb-3">Functions ({funcCount})</h4>
        {funcCount > 0 ? (
          <div className="space-y-1">
            {moduleData.functions.map(fn => (
              <div key={fn.name} className="text-xs bg-gray-800 rounded px-3 py-2">
                <span className="font-mono text-blue-300">{fn.exports}</span>
                <span className="text-gray-500">({(fn.params || []).join(', ')})</span>
                <span className="text-gray-400 ml-2">→ {fn.returns || 'void'}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-gray-600">No functions defined</p>}
      </div>

      {/* Schema Tables */}
      {tableCount > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-cyan-400 mb-3">DB Tables ({tableCount})</h4>
          <div className="flex flex-wrap gap-2">
            {moduleData.schema.tables.map(table => (
              <span key={table} className="text-xs text-cyan-300/80 bg-cyan-900/30 px-2 py-1 rounded font-mono">{table}</span>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      {(moduleData.events?.publishes?.length > 0 || moduleData.events?.subscribes?.length > 0) && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-pink-400 mb-3">Events</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {moduleData.events.publishes && moduleData.events.publishes.length > 0 && (
              <div>
                <h5 className="text-xs text-gray-500 mb-1">Publishes:</h5>
                <div className="flex flex-wrap gap-1">
                  {moduleData.events.publishes.map(evt => (
                    <span key={evt} className="text-xs text-pink-300/80 bg-pink-900/30 px-2 py-0.5 rounded">{evt}</span>
                  ))}
                </div>
              </div>
            )}
            {moduleData.events.subscribes && moduleData.events.subscribes.length > 0 && (
              <div>
                <h5 className="text-xs text-gray-500 mb-1">Subscribes:</h5>
                <div className="flex flex-wrap gap-1">
                  {moduleData.events.subscribes.map(evt => (
                    <span key={evt} className="text-xs text-pink-300/80 bg-pink-900/30 px-2 py-0.5 rounded">{evt}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ModuleStatusWidget;
