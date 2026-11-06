async function claimTradeedRuntime({ probeHealth, startDatabase }) {
  try {
    const response = await probeHealth('http://127.0.0.1:8080/api/health');
    if (response) throw new Error("Trade'Ed dashboard port is already owned outside launcher supervision");
  } catch (error) {
    if (String(error?.message).includes('already owned outside')) throw error;
  }
  return startDatabase();
}

async function stopLauncherOwnedRuntime({ stopApplications, stopDatabase }) {
  await stopApplications();
  await stopDatabase();
}

// Individual applications do not own the shared PostgreSQL lifecycle. Only
// full launcher shutdown may invoke stopLauncherOwnedRuntime.
async function stopScopedApplication({ appId, stopApplication }) {
  if (!['tradeed', 'dressed', 'researched'].includes(appId) || typeof stopApplication !== 'function')
    throw new Error('Scoped application stop requires a known application');
  return stopApplication(appId);
}

module.exports = { claimTradeedRuntime, stopLauncherOwnedRuntime, stopScopedApplication };
