'use strict';

const capabilityRegistry = require('../registry/capabilityRegistry');
const dependencyGraph = require('../registry/dependencyGraph');

// Platform services are always available — don't check them as module dependencies
const PLATFORM_SERVICES = new Set([
  'db',
  'cache',
  'auth',
  'log',
  'validate',
  'events',
  'intelligence',
]);

/**
 * Resolve stage — validates cross-module dependencies after all modules
 * are registered but before wiring begins.
 *
 * Checks:
 *   - All required capabilities exist in CapabilityRegistry
 *   - All declared dependencies are registered in ModuleRegistry (excluding platform services)
 *   - Circular dependencies are present in DependencyGraph
 *
 * @param {Array<Object>} modules - All registered modules from register()
 * @returns {boolean} true on success
 * @throws {Error} If any dependency is unsatisfied
 */
function resolve(modules) {
  const errors = [];
  const moduleNames = new Set(modules.map((m) => m.manifest.name));

  for (const mod of modules) {
    const { manifest } = mod;

    // 1. Check required capabilities exist
    if (manifest.requires && manifest.requires.length > 0) {
      for (const req of manifest.requires) {
        if (!capabilityRegistry.exists(req)) {
          errors.push(
            `Module "${manifest.name}" requires capability "${req}" which is not available`
          );
        }
      }
    }

    // 2. Check declared dependencies are registered (skip platform services)
    if (manifest.dependencies && manifest.dependencies.length > 0) {
      for (const dep of manifest.dependencies) {
        // Skip platform services — they're always available
        if (PLATFORM_SERVICES.has(dep)) {
          continue;
        }

        if (!moduleNames.has(dep)) {
          errors.push(
            `Module "${manifest.name}" declares dependency "${dep}" which was not discovered`
          );
        }
      }
    }
  }

  // 3. Detect circular dependencies via DependencyGraph
  const cycles = dependencyGraph.detectCycles();
  for (const cycle of cycles) {
    errors.push(
      `Circular dependency detected: ${cycle.join(' -> ')}`
    );
  }

  if (errors.length > 0) {
    const msg = `Dependency resolution failed:\n  - ${errors.join('\n  - ')}`;
    throw new Error(msg);
  }

  return true;
}

module.exports = resolve;