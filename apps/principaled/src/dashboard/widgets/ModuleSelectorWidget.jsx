import React, { useEffect, useState } from 'react';

function ModuleSelectorWidget() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedModule, setExpandedModule] = useState(null);

  useEffect(() => { fetchModules(); }, []);

  const fetchModules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('jwt_token');
      const response = await fetch('/api/modules', {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setModules(data.data || []);
      setError(null);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const toggleModule = async (moduleName, currentEnabled) => {
    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`/api/modules/${encodeURIComponent(moduleName)}/state`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchModules();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const toggleExpand = (moduleName) => { setExpandedModule(expandedModule === moduleName ? null : moduleName); };

  if (loading) { return (<div className="flex items-center justify-center py-20"><div className="spinner"></div></div>); }

  return (
    <div className="h-[calc(100vh-220px)] overflow-y-auto pr-2">
      <h2 className="text-2xl font-bold text-white mb-2 sticky top-0 bg-timsys-dark z-10 py-2">Module Portal</h2>
      <p className="text-gray-400 mb-6">{modules.length} platform modules</p>
      {error && (<div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">{error}</div>)}
      <div className="space-y-2 pb-8">
        {modules.map((module) => (
          <div key={module.name} className={`rounded-lg border transition-all ${expandedModule === module.name ? 'border-timsys-primary bg-gray-850' : 'border-gray-800 bg-gray-900'}`}>
            <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(module.name)}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white truncate flex-1">{module.name}</h3>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">v{module.version}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${module.enabled ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>{module.enabled ? 'ENABLED' : 'DISABLED'}</span>
              </div>
              <div className="flex items-center gap-4 pl-4">
                <button onClick={(e) => { e.stopPropagation(); toggleModule(module.name, module.enabled); }} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none" style={{ backgroundColor: module.enabled ? '#6d4aff' : '#4b5563' }}>
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: module.enabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                </button>
                <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200`} style={{ transform: expandedModule === module.name ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {expandedModule === module.name && (
              <div className="px-4 pb-4 border-t border-gray-800 pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-900 rounded border border-gray-800 p-3"><h4 className="text-sm font-semibold text-gray-300 mb-2">Dependencies</h4>{module.dependencies && module.dependencies.length > 0 ? (<ul className="space-y-1 max-h-32 overflow-y-auto">{module.dependencies.map((dep) => (<li key={dep} className="text-xs text-gray-400 flex items-center gap-2"><span className="w-1 h-1 bg-gray-500 rounded-full flex-shrink-0" /><span className="truncate">{dep}</span></li>))}</ul>) : <p className="text-xs text-gray-600 italic">None</p>}</div>
                  <div className="bg-gray-900 rounded border border-gray-800 p-3"><h4 className="text-sm font-semibold text-green-400 mb-2">Provides</h4>{module.provides && module.provides.length > 0 ? (<ul className="space-y-1 max-h-32 overflow-y-auto">{module.provides.map((prov) => (<li key={prov} className="text-xs text-green-300/80 flex items-center gap-2"><span className="w-1 h-1 bg-green-500 rounded-full flex-shrink-0" /><span className="truncate">{prov}</span></li>))}</ul>) : <p className="text-xs text-gray-600 italic">None</p>}</div>
                  <div className="bg-gray-900 rounded border border-gray-800 p-3"><h4 className="text-sm font-semibold text-orange-400 mb-2">Requires</h4>{module.requires && module.requires.length > 0 ? (<ul className="space-y-1 max-h-32 overflow-y-auto">{module.requires.map((req) => (<li key={req} className="text-xs text-orange-300/80 flex items-center gap-2"><span className="w-1 h-1 bg-orange-500 rounded-full flex-shrink-0" /><span className="truncate">{req}</span></li>))}</ul>) : <p className="text-xs text-gray-600 italic">None</p>}</div>
                </div>
                <div className="bg-gray-900 rounded border border-gray-800 p-3"><h4 className="text-sm font-semibold text-blue-400 mb-2">Functions ({module.functions?.length || 0})</h4>{module.functions && module.functions.length > 0 ? (<div className="space-y-1 max-h-40 overflow-y-auto">{module.functions.map((fn) => (<div key={fn.name} className="text-xs text-gray-300 bg-gray-800 rounded px-2 py-1 flex items-center"><span className="font-mono truncate flex-1">{fn.exports}</span><span className="text-gray-500 ml-2">→ {fn.returns || 'void'}</span></div>))}</div>) : <p className="text-xs text-gray-600 italic">None</p>}</div>
                <div className="bg-gray-900 rounded border border-gray-800 p-3"><h4 className="text-sm font-semibold text-purple-400 mb-2">Routes ({module.routes?.length || 0})</h4>{module.routes && module.routes.length > 0 ? (<div className="overflow-x-auto"><table className="w-full text-xs min-w-[400px]"><thead><tr className="text-gray-500 border-b border-gray-800"><th className="text-left py-1 pr-4">Method</th><th className="text-left py-1 pr-4">Path</th><th className="text-left py-1 pr-4">Handler</th><th className="text-left py-1">Auth</th></tr></thead><tbody>{module.routes.map((route, idx) => (<tr key={idx} className="border-b border-gray-800/50"><td className="py-1 pr-4"><span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${route.method === 'GET' ? 'bg-green-900/50 text-green-300' : route.method === 'POST' ? 'bg-blue-900/50 text-blue-300' : route.method === 'PUT' ? 'bg-yellow-900/50 text-yellow-300' : route.method === 'DELETE' ? 'bg-red-900/50 text-red-300' : 'bg-gray-800 text-gray-300'}`}>{route.method}</span></td><td className="py-1 pr-4 text-gray-300 font-mono truncate max-w-[200px]">{route.path}</td><td className="py-1 pr-4 text-gray-400 truncate max-w-[150px]">{route.handler}</td><td className="py-1">{route.auth_required ? <span className="text-red-300 text-xs">Required</span> : <span className="text-gray-600 text-xs">Public</span>}</td></tr>))}</tbody></table></div>) : <p className="text-xs text-gray-600 italic">None</p>}</div>
                {module.schema && module.schema.tables && module.schema.tables.length > 0 && (<div className="bg-gray-900 rounded border border-gray-800 p-3"><h4 className="text-sm font-semibold text-cyan-400 mb-2">Tables ({module.schema.tables.length})</h4><div className="flex flex-wrap gap-2">{module.schema.tables.map((table) => (<span key={table} className="text-xs text-cyan-300/80 bg-cyan-900/30 px-2 py-1 rounded font-mono">{table}</span>))}</div></div>)}
                {(module.events?.publishes?.length > 0 || module.events?.subscribes?.length > 0) && (<div className="bg-gray-900 rounded border border-gray-800 p-3"><h4 className="text-sm font-semibold text-pink-400 mb-2">Events</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{module.events.publishes && module.events.publishes.length > 0 && (<div><h5 className="text-xs text-gray-500 mb-1">Publishes:</h5><div className="flex flex-wrap gap-1">{module.events.publishes.map((evt) => (<span key={evt} className="text-xs text-pink-300/80 bg-pink-900/30 px-2 py-0.5 rounded">{evt}</span>))}</div></div>)}{module.events.subscribes && module.events.subscribes.length > 0 && (<div><h5 className="text-xs text-gray-500 mb-1">Subscribes:</h5><div className="flex flex-wrap gap-1">{module.events.subscribes.map((evt) => (<span key={evt} className="text-xs text-pink-300/80 bg-pink-900/30 px-2 py-0.5 rounded">{evt}</span>))}</div></div>)}</div></div>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ModuleSelectorWidget;
