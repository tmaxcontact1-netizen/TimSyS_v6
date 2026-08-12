const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.resolve(__dirname, '../../modules');

function discoverDir(dir, discovered) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === '.gitkeep') continue;

    const moduleDir = path.join(dir, entry.name);
    const manifestPath = path.join(moduleDir, 'module.json');

    if (fs.existsSync(manifestPath)) {
      let manifest;
      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        manifest = JSON.parse(raw);
      } catch (err) {
        throw new Error(
          `Discover: Failed to parse manifest for "${entry.name}": ${err.message}`
        );
      }

      if (manifest.status === 'draft') {
        continue;
      }
      discovered.push({
        name: manifest.name || entry.name,
        dir: moduleDir,
        manifest,
      });
    }

    // Recurse into subdirectories
    discoverDir(moduleDir, discovered);
  }

  return discovered;
}

function discover() {
  const discovered = [];

  if (!fs.existsSync(MODULES_DIR)) {
    return discovered;
  }

  return discoverDir(MODULES_DIR, discovered);
}

module.exports = discover;
