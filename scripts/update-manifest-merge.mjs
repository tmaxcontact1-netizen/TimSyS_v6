import assert from 'node:assert/strict';

export function cumulativeBundles(previous, replacements) {
  assert.equal(previous.schemaVersion, 1, 'A valid published baseline is required');
  assert.ok(Array.isArray(previous.bundles));
  for (const list of [previous.bundles, replacements]) {
    assert.equal(new Set(list.map(b => b.id)).size, list.length, 'Duplicate bundle identifiers');
    for (const b of list) assert.ok(b.id && b.version && /^https:\/\//.test(b.url) && /^[a-f0-9]{64}$/i.test(b.sha256) && Number.isSafeInteger(b.size) && b.size > 0, 'Invalid bundle');
  }
  const replaced = new Set(replacements.map(b => b.id));
  return [...previous.bundles.filter(b => !replaced.has(b.id)), ...replacements];
}

export async function publishedBaseline() {
  const response = await fetch('https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/latest/download/timsys-update.json', {
    headers: {'Cache-Control': 'no-cache'}, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Cannot preserve the published update list (${response.status}); packaging stopped.`);
  const baseline = await response.json();
  cumulativeBundles(baseline, []);
  return baseline;
}
