'use strict';

const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.resolve(process.cwd(), 'modules');

/**
 * Discover stage — scans /modules for module.json manifests.
 *
 * @returns {Array<{name: string, dir: string, manifest: Object}>}
 * @throws {Error} If modules directory doesn't exist or manifest is invalid JSON
 */
function discover() {
  const discovered = [];

  if (!fs.existsSync(MODULES_DIR)) {
    return discovered;
  }

  const entries = fs.readdirSync(MODULES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const moduleDir = path.join(MODULES_DIR, entry.name);
    const manifestPath = path.join(moduleDir, 'module.json');

    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    let manifest;
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `Discover: Failed to parse manifest for "${entry.name}": ${err.message}`
      );
    }

    discovered.push({
      name: manifest.name || entry.name,
      dir: moduleDir,
      manifest,
    });
  }

  return discovered;
}

module.exports = discover;