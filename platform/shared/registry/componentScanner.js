'use strict';

const fs = require('fs');
const path = require('path');
const componentRegistry = require('./componentRegistry');
const moduleRegistry = require('./moduleRegistry');
const log = require('../services/log');
const intelligenceContribution = require('../contracts/intelligenceContribution');

const MODULES_DIR = path.resolve(__dirname, '../../modules');

function walkModuleDirs(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.gitkeep' || entry.name === 'node_modules') continue;

    const fullPath = path.join(dir, entry.name);
    const hasManifest = fs.existsSync(path.join(fullPath, 'module.json'));
    const hasComponent = fs.existsSync(path.join(fullPath, 'component.json'));

    if (hasManifest || hasComponent) {
      results.push(fullPath);
    }

    // Always recurse to find nested modules
    walkModuleDirs(fullPath, results);
  }
  return results;
}

function scan() {
  if (!fs.existsSync(MODULES_DIR)) {
    log.warn('Components directory not found, skipping component scan', { path: MODULES_DIR });
    return [];
  }

  const moduleDirs = walkModuleDirs(MODULES_DIR, []);
  const componentsFound = [];

  moduleDirs.forEach(function(modDir) {
    const modName = path.basename(modDir);
    const candidateManifest = path.join(modDir, 'module.json');
    if (fs.existsSync(candidateManifest)) {
      const candidate = JSON.parse(fs.readFileSync(candidateManifest, 'utf8'));
      if (candidate.status === 'draft') return;
    }

    // Look for explicit component.json
    const componentFile = path.join(modDir, 'component.json');
    if (fs.existsSync(componentFile)) {
      try {
        const componentSpec = JSON.parse(fs.readFileSync(componentFile, 'utf8'));
        componentSpec.ownerModule = modName;
        if (componentSpec.intelligence) {
          intelligenceContribution.assertValid(componentSpec.intelligence, componentSpec.name);
          intelligenceContribution.assertSchema(componentSpec.intelligence, componentSpec.name, require('../services/db'));
        }
        const manifestFile = path.join(modDir, 'module.json');
        if (fs.existsSync(manifestFile)) {
          const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
          componentSpec.dependencies = componentSpec.dependencies || manifest.requires || [];
          componentSpec.routes = componentSpec.routes || manifest.routes || null;
          componentSpec.schema = componentSpec.schema || manifest.schema || null;
          componentSpec.capabilities = componentSpec.capabilities || manifest.provides || null;
          componentSpec.events = componentSpec.events || manifest.events || null;
        }

        componentRegistry.register(componentSpec);
        componentsFound.push({
          name: componentSpec.name,
          module: modName,
          type: componentSpec.type || 'generic'
        });

        log.info('Registered component from component.json', {
          component: componentSpec.name,
          module: modName
        });
      } catch (err) {
        log.error('Failed to parse component.json', {
          module: modName,
          error: err.message
        });
        throw err;
      }
      return;
    }

    // Infer components from capability declarations in module.json
    const manifestFile = path.join(modDir, 'module.json');
    if (fs.existsSync(manifestFile)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

        if (manifest.provides && Array.isArray(manifest.provides)) {
          manifest.provides.forEach(function(provision) {
            const parts = provision.split(':');

            if (parts[0] === 'capability' && parts[1]) {
              const compName = parts[1];

              const routes = manifest.routes ? manifest.routes.map(function(r) {
                return { path: r.path, method: r.method, handler: r.handler };
              }) : null;

              const schema = manifest.schema || null;
              const capabilities = manifest.provides || null;
              const events = manifest.events || null;

              const inferredComponent = {
                name: compName,
                type: inferComponentType(compName),
                ownerModule: modName,
                dependencies: manifest.requires || [],
                routes: routes,
                schema: schema,
                capabilities: capabilities,
                events: events
              };

              componentRegistry.register(inferredComponent);
              componentsFound.push({
                name: compName,
                module: modName,
                type: inferredComponent.type
              });

              log.info('Inferred component from capability', {
                component: compName,
                module: modName,
                type: inferredComponent.type
              });
            }
          });
        }
      } catch (err) {
        log.error('Failed to parse module.json during scan', {
          module: modName,
          error: err.message
        });
      }
    }
  });

  log.info('Component scan complete', { count: componentsFound.length });
  return componentsFound;
}

function inferComponentType(name) {
  var lower = name.toLowerCase();

  if (lower.includes('registry')) return 'registry';
  if (lower.includes('allocation') || lower.includes('room')) return 'allocation';
  if (lower.includes('inventory') || lower.includes('equipment')) return 'inventory';
  if (lower.includes('medical') || lower.includes('health')) return 'medical';
  if (lower.includes('attendance') || lower.includes('schedule')) return 'scheduling';
  if (lower.includes('incident') || lower.includes('report')) return 'reporting';

  return 'generic';
}

function clear() {
  componentRegistry.clear();
  log.info('Component registry cleared');
}

module.exports = {
  scan: scan,
  inferComponentType: inferComponentType,
  clear: clear
};
