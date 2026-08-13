import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/base';

const label = value => String(value || '').replaceAll('_', ' ');

function Check({ checked, disabled, onChange, labelText }) {
  return <label className={`inline-flex items-center gap-2 text-sm ${disabled ? 'text-gray-500' : 'text-gray-200 cursor-pointer'}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="h-4 w-4 accent-violet-500" />
    {labelText}
  </label>;
}

function ModulePortalPage() {
  const navigate = useNavigate();
  const [catalogue, setCatalogue] = useState(null);
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = async () => {
    try {
      const response = await apiClient.get('/builder/catalogue');
      setCatalogue(response.data?.data || null);
      setError(null);
    } catch (err) { setError(err.response?.data?.error?.message || err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const app = useMemo(() => catalogue?.apps?.find(item => item.id === selectedAppId), [catalogue, selectedAppId]);

  const toggle = async (kind, item) => {
    setNotice(null);
    if (item.enabled && item.removalImpact?.length) {
      setNotice(`Cannot remove ${label(item.name)} yet. Remove these dependants first: ${item.removalImpact.map(label).join(', ')}.`);
      return;
    }
    try {
      const path = kind === 'module' ? '/modules' : '/components';
      const key = kind === 'module' ? 'moduleName' : 'componentName';
      if (item.enabled) await apiClient.delete(`${path}/unassign`, { params: { appId: app.id, [key]: item.name } });
      else await apiClient.post(`${path}/assign`, { appId: app.id, [key]: item.name });
      await load();
    } catch (err) {
      const detail = err.response?.data?.error;
      setNotice(detail?.affected?.length ? `${detail.message}: ${detail.affected.map(label).join(', ')}` : detail?.message || err.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-timsys-dark flex items-center justify-center"><div className="spinner" /></div>;

  return <div className="min-h-screen bg-timsys-dark text-white">
    <nav className="border-b border-gray-800 bg-gray-900/80 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => app ? setSelectedAppId(null) : navigate('/')} className="text-gray-400 hover:text-white">← Back</button>
          <h1 className="text-2xl font-bold text-timsys-primary">Builder</h1>
        </div>
        <button onClick={() => navigate('/')} className="text-sm text-gray-300 hover:text-white">Return to launcher</button>
      </div>
    </nav>
    <main className="max-w-7xl mx-auto px-6 py-8">
      {error && <div className="mb-5 rounded border border-red-500 bg-red-950/60 p-4 text-red-200">{error}</div>}
      {notice && <div className="mb-5 rounded border border-amber-500 bg-amber-950/50 p-4 text-amber-100">{notice}</div>}

      {!app ? <>
        <h2 className="text-2xl font-semibold mb-2">Select an admin application</h2>
        <p className="text-gray-400 mb-6">Each application shows its own configuration plus the essential platform services it uses. MemecoinEd is intentionally isolated.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(catalogue?.apps || []).map(item => <button key={item.id} onClick={() => setSelectedAppId(item.id)} className="bg-gray-900 border border-gray-800 hover:border-timsys-primary rounded-xl p-6 text-left">
            <h3 className="text-xl font-bold">{item.displayName}</h3><p className="text-sm text-gray-400 mt-2">{item.description}</p>
            <p className="text-xs text-gray-500 mt-5">{item.modules.filter(module => module.enabled).length} app modules · {item.essentialServices.length} essential services</p>
          </button>)}
        </div>
        <section className="mt-10 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold">Module opportunity scanner</h2>
          <p className="text-gray-400 mt-2">The scanner uses registered capabilities, routes and functions to recommend reusable configurations. It reports confidence, current coverage, missing scripts and suggested implementation work; it does not create or activate code without review.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">{(catalogue?.recommendations?.suggestions || []).slice(0, 8).map((suggestion, index) => <div key={`${suggestion.moduleName}-${index}`} className="rounded-lg border border-gray-700 bg-gray-950 p-4">
            <div className="flex justify-between gap-3"><h3 className="font-semibold capitalize">{label(suggestion.moduleName)}</h3><span className="text-sm text-timsys-primary">{suggestion.completionPercent || Math.round((suggestion.confidence || 0) * 100)}% reusable</span></div>
            <p className="text-xs text-gray-400 mt-2">{suggestion.action === 'complete_partial' ? 'Complete an existing partial module' : 'Potential new module configuration'}</p>
            <p className="text-xs text-gray-500 mt-2">Estimated work: {suggestion.estimatedEffort} · {suggestion.missingArtifacts} missing artefact(s)</p>
            <ul className="mt-3 space-y-1">{(suggestion.recommendedNextSteps || []).map(step => <li key={step} className="text-xs text-gray-400">• {step}</li>)}</ul>
          </div>)}</div>
          {(catalogue?.recommendations?.suggestions || []).length === 0 && <p className="text-sm text-gray-500 mt-4">No safe recommendations are available from the current registry.</p>}
        </section>
      </> : <>
        <h2 className="text-2xl font-semibold">{app.displayName}</h2>
        <p className="text-gray-400 mt-1 mb-7">App-specific configuration · User-profile modules are restricted to superusers and principals.</p>

        <section className="mb-8">
          <h3 className="text-lg font-semibold mb-3">Essential backend services</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{app.essentialServices.map(service => <div key={service.name} className="rounded-lg border border-gray-800 bg-gray-900 p-3"><Check checked disabled labelText={label(service.name)} /><p className="text-xs text-gray-500 mt-2">Required platform service</p></div>)}</div>
        </section>

        <section>
          <h3 className="text-lg font-semibold">Modules and component manifests</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">Checkboxes add or remove configuration. Dependency impact is shown before removal.</p>
          <div className="space-y-3">{app.modules.map(module => <article key={module.name} className="rounded-xl border border-gray-800 bg-gray-900">
            <div className="p-4 flex gap-4 items-center">
              <Check checked={module.enabled} disabled={module.required} onChange={() => toggle('module', module)} labelText="" />
              <button onClick={() => setExpanded(expanded === module.name ? null : module.name)} className="flex-1 text-left">
                <span className="font-semibold capitalize">{label(module.name)}</span><span className="ml-3 text-xs text-gray-500">v{module.version || 'unknown'}</span>
                {module.profileAccess && <span className="ml-3 text-xs text-amber-300">Superuser / Principal only</span>}{module.required && <span className="ml-3 text-xs text-green-300">Required baseline</span>}
                <p className="text-xs text-gray-500 mt-1">{module.components.length} components · {(module.provides || []).length} capabilities</p>
              </button>
              <span className="text-gray-500">{expanded === module.name ? '▲' : '▼'}</span>
            </div>
            {expanded === module.name && <div className="border-t border-gray-800 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div><h4 className="text-sm font-semibold mb-2">Components</h4>{module.components.length ? module.components.map(component => <div key={component.name} className="mb-2 rounded border border-gray-700 bg-gray-950 p-3">
                <div className="flex justify-between"><Check checked={component.enabled ?? module.enabled} disabled={component.required} onChange={() => toggle('component', component)} labelText={label(component.name)} /><span className="text-xs text-gray-500">{component.type}</span></div>
                <pre className="mt-3 max-h-48 overflow-auto text-xs text-gray-400 whitespace-pre-wrap">{JSON.stringify(component, null, 2)}</pre>
              </div>) : <p className="text-sm text-gray-500">No app-specific components. This module is a backend service.</p>}</div>
              <div className="space-y-3">
                <div className="rounded border border-gray-700 p-3"><h4 className="text-sm font-semibold">Dependencies</h4><p className="text-xs text-gray-400 mt-2">{(module.dependencies || []).join(', ') || 'None'}</p></div>
                <div className="rounded border border-gray-700 p-3"><h4 className="text-sm font-semibold">Required capabilities</h4><p className="text-xs text-gray-400 mt-2">{(module.requires || []).join(', ') || 'None'}</p></div>
                <div className={`rounded border p-3 ${module.removalImpact.length ? 'border-amber-700 bg-amber-950/20' : 'border-gray-700'}`}><h4 className="text-sm font-semibold">Removal impact</h4><p className="text-xs text-gray-400 mt-2">{module.removalImpact.length ? module.removalImpact.map(label).join(', ') : 'No enabled modules depend on this module.'}</p></div>
              </div>
            </div>}
          </article>)}</div>
        </section>
      </>}
    </main>
  </div>;
}

export default ModulePortalPage;
