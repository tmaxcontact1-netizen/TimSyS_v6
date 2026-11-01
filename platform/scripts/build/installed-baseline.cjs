const fs = require('node:fs');
const path = require('node:path');
function createInstalledBaseline(sourceRoot, at = new Date().toISOString()) {
  const version = id => JSON.parse(fs.readFileSync(path.join(sourceRoot, 'apps', id, 'package.json'), 'utf8')).version;
  const launcherVersion = version('launcher');
  const bundles = {};
  for (const id of ['platform', 'launcher-ui', 'dressed', 'researched', 'tradeed']) {
    bundles[id] = { version: ['platform', 'launcher-ui'].includes(id) ? launcherVersion : version(id), publishedAt: at, kind: 'installed-baseline' };
  }
  return { schemaVersion: 1, builtAt: at, launcherVersion, bundles };
}
module.exports = { createInstalledBaseline };
