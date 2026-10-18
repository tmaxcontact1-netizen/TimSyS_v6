const APP_ONLY = new Set(['researched', 'dressed']);
// No database lifecycle operations belong in an independent app update.
async function applyAppUpdate(result, runtime) {
  const ids = result.installed.map(x => x.id);
  if (!ids.length || ids.some(id => !APP_ONLY.has(id))) return null;
  const running = ids.filter(id => ['starting', 'running', 'degraded'].includes(runtime.status(id).state));
  runtime.progress('Applying app update; other applications remain running.');
  try {
    for (const id of running) await runtime.stop(id);
    await runtime.refreshRoots(ids);
    for (const id of running) { await runtime.start(id); await runtime.reload(id); }
    await runtime.confirm();
    runtime.progress('App update complete. Other applications were not restarted.');
    return { ...result, restartRequired: false, restartScheduled: false, appliedWithoutRestart: true };
  } catch (error) {
    const recoveryErrors = [];
    for (const id of running) { try { await runtime.stop(id); } catch(e) { recoveryErrors.push(e.message); } }
    try {
      if (!await runtime.rollback(error.message)) throw Error('No pending update available to restore');
      await runtime.refreshRoots(ids);
      for (const id of running) { try { await runtime.start(id); await runtime.reload(id); } catch(e) { recoveryErrors.push(e.message); } }
    } catch(e) { recoveryErrors.push(e.message); }
    throw Error(`App update failed: ${error.message}. ${recoveryErrors.length ? 'Recovery needs attention: '+recoveryErrors.join('; ') : 'Previous app version restored.'}`);
  }
}
module.exports = { applyAppUpdate };
