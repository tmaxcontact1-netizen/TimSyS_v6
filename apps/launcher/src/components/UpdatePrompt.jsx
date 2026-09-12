import React, { useEffect, useState } from 'react';
import { reportActionFeedback } from '../../../shared-ui/react/index.js';

const names = { platform: 'TimSyS services', principaled: "Principal'Ed", memecoined: "MemeCoin'Ed", dressed: "Dress'Ed", researched: "Research'Ed", 'launcher-ui': 'Launcher' };
const size = bytes => bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function UpdatePrompt() {
  const [update, setUpdate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!window.electronAPI?.updates) return undefined;
    window.electronAPI.updates.check()
      .then(result => { if (active && result.updateAvailable) setUpdate(result); })
      .catch(() => {}); // The manual Updates panel remains available when launch-time checking fails.
    return () => { active = false; };
  }, []);

  if (!update || dismissed) return null;
  const install = async () => {
    setBusy(true);
    setError('');
    reportActionFeedback({ method: 'POST', phase: 'working', message: 'Installing the verified update…' });
    try {
      const result = await window.electronAPI.updates.install();
      if (!result.restartScheduled && result.restartRequired) throw new Error('The update was verified but the restart was not scheduled.');
      reportActionFeedback({ method: 'POST', phase: 'success', message: 'Update installed and verified. Restarting TimSyS…' });
    } catch (failure) {
      setBusy(false);
      setError(failure.message || 'The update could not be installed.');
      reportActionFeedback({ method: 'POST', phase: 'error', message: 'The update could not be installed.' });
    }
  };

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/75 p-6 backdrop-blur-sm" role="presentation">
    <section className="w-full max-w-lg rounded-2xl border border-blue-700/60 bg-gray-900 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-blue-300">Update available</p>
      <h1 id="update-title" className="mt-2 text-2xl font-semibold text-white">Install TimSyS {update.releaseVersion}</h1>
      <p className="mt-2 text-sm leading-6 text-gray-300">A verified update is ready. Install it now to use the latest apps and services.</p>
      {update.notes && <p className="mt-3 rounded-lg bg-gray-950 p-3 text-sm text-gray-400">{update.notes}</p>}
      <ul className="mt-4 divide-y divide-gray-800 rounded-lg border border-gray-800 bg-gray-950 px-4">
        {update.available.map(item => <li key={item.id} className="flex items-center justify-between py-3 text-sm"><span className="text-gray-200">{names[item.id] || item.id}</span><span className="text-gray-500">{size(item.size)}</span></li>)}
      </ul>
      {error && <p className="mt-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200" role="alert">{error}</p>}
      <p className="mt-4 text-xs leading-5 text-gray-500">The launcher will restart after installation. Your records, photos, documents and settings will not be replaced.</p>
      <footer className="mt-6 flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={() => setDismissed(true)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800 disabled:opacity-50">Not now</button>
        <button type="button" disabled={busy} onClick={install} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">{busy ? 'Installing…' : 'Install update'}</button>
      </footer>
    </section>
  </div>;
}
