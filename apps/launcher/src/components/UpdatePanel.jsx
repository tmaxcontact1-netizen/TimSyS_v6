import React, { useEffect, useState } from 'react';
import { ConfirmationDialog, reportActionFeedback } from '../../../shared-ui/react/index.js';

const names = { platform: 'TimSyS services', principaled: "Principal'Ed", memecoined: "MemeCoin'Ed", dressed: "Dress'Ed", researched: "Research'Ed", 'launcher-ui': 'Launcher interface' };
const size = bytes => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function UpdatePanel() {
  const [state, setState] = useState({ checking: true, result: null, error: '' });
  const [confirmInstall, setConfirmInstall] = useState(false);
  const check = async () => {
    if (!window.electronAPI?.updates) return setState({ checking: false, result: { development: true }, error: '' });
    setState({ checking: true, result: null, error: '' });
    try { setState({ checking: false, result: await window.electronAPI.updates.check(), error: '' }); }
    catch (error) { setState({ checking: false, result: null, error: error.message }); }
  };
  useEffect(() => { void check(); }, []);
  const install = async () => {
    setConfirmInstall(false);
    setState(current => ({ ...current, checking: true, error: '' }));
    reportActionFeedback({ method: 'POST', phase: 'working', message: 'Installing the verified update…' });
    try { await window.electronAPI.updates.install(); }
    catch (error) { setState(current => ({ ...current, checking: false, error: error.message })); reportActionFeedback({ method: 'POST', phase: 'error', message: 'The update could not be installed. Review the error in the Updates panel.' }); }
  };
  if (state.result?.development) return null;
  return <><section className="mt-10 rounded-lg border border-gray-800 bg-gray-900 p-5" aria-live="polite">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-semibold text-white">Updates</h2><p className="mt-1 text-sm text-gray-400">Install app updates without downloading another full installer.</p></div>
      <button type="button" disabled={state.checking} onClick={check} className="rounded bg-gray-700 px-4 py-2 text-sm text-white disabled:opacity-50">{state.checking ? 'Checking…' : 'Check again'}</button>
    </div>
    {state.error && <p className="mt-4 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{state.error}</p>}
    {state.result && !state.result.updateAvailable && <p className="mt-4 text-sm text-emerald-300">Everything is up to date.</p>}
    {state.result?.updateAvailable && <div className="mt-4">
      <p className="text-sm text-white">Release {state.result.releaseVersion} is ready.</p>
      {state.result.notes && <p className="mt-1 text-sm text-gray-400">{state.result.notes}</p>}
      <ul className="mt-3 space-y-2">{state.result.available.map(item => <li key={item.id} className="flex justify-between rounded bg-gray-950 px-3 py-2 text-sm"><span>{names[item.id] || item.id}</span><span className="text-gray-400">{size(item.size)}</span></li>)}</ul>
      <p className="mt-3 text-xs text-gray-500">The Launcher will close and reopen after verification. Your data and settings are not replaced.</p>
      <button type="button" disabled={state.checking} onClick={() => setConfirmInstall(true)} className="mt-4 rounded bg-timsys-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{state.checking ? 'Installing…' : 'Install update'}</button>
    </div>}
  </section><ConfirmationDialog open={confirmInstall} title="Install this update now?" description="TimSyS will verify and install the selected update." consequence="The launcher will close and reopen automatically. Your data and settings will remain in place." confirmLabel="Install update" onConfirm={install} onCancel={() => setConfirmInstall(false)} /></>;
}
