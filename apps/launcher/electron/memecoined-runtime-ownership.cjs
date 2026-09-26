async function claimMemecoinedRuntime({ probeHealth, startDatabase }) {
  try {
    const response = await probeHealth('http://127.0.0.1:8080/api/health');
    if (response) throw new Error('MemeCoinEd dashboard port is already owned outside launcher supervision');
  } catch (error) {
    if (String(error?.message).includes('already owned outside')) throw error;
  }
  return startDatabase();
}

async function stopLauncherOwnedRuntime({ stopApplications, stopDatabase }) {
  await stopApplications();
  await stopDatabase();
}

module.exports = { claimMemecoinedRuntime, stopLauncherOwnedRuntime };
