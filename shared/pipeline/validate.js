'use strict';

const path = require('path');
const fs = require('fs');

const capabilityRegistry = require('../registry/capabilityRegistry');

const REQUIRED_MANIFEST_FIELDS = [
  'name',
  'version',
  'dependencies',
  'provides',
  'requires',
  'routes',
  'functions',
];

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Validate stage — checks manifest structure, required exports,
 * and dependency availability.
 *
 * @param {Object} module - { name, dir, manifest } from discover
 * @returns {Object} Validated module with index reference loaded
 * @throws {Error} On any validation failure — fails fast with detail
 */
function validate(module) {
  const { manifest, dir } = module;
  const errors = [];

  // 1. Check required manifest fields
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!(field in manifest)) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if (errors.length === 0) {
    // 2. Validate name format (lowercase, underscores, no spaces)
    if (!/^[a-z][a-z0-9_]*$/.test(manifest.name)) {
      errors.push(
        `Invalid module name "${manifest.name}": must be lowercase with underscores only`
      );
    }

    // 3. Validate version format (semver-ish)
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      errors.push(`Invalid version "${manifest.version}": must be x.y.z format`);
    }

    // 4. Validate routes
    if (manifest.routes) {
      const routeKeys = new Set();
      for (const route of manifest.routes) {
        if (!route.path || !route.method || !route.handler) {
          errors.push(`Route missing required fields (path, method, handler)`);
          continue;
        }

        if (!VALID_METHODS.includes(route.method.toUpperCase())) {
          errors.push(`Route "${route.path}": invalid method "${route.method}"`);
        }

        const key = `${route.method.toUpperCase()} ${route.path}`;
        if (routeKeys.has(key)) {
          errors.push(`Duplicate route: ${key}`);
        }
        routeKeys.add(key);

        // Handler must be declared in functions
        if (manifest.functions) {
          const funcNames = manifest.functions.map((f) => f.name);
          if (!funcNames.includes(route.handler)) {
            errors.push(
              `Route "${key}": handler "${route.handler}" not declared in functions`
            );
          }
        }
      }
    }

    // 5. Validate functions naming convention {module}_{operation}
    if (manifest.functions) {
      for (const fn of manifest.functions) {
        if (!fn.name || !fn.exports) {
          errors.push(`Function missing required fields (name, exports)`);
          continue;
        }

        const expectedPrefix = `${manifest.name}_`;
        if (!fn.name.startsWith(expectedPrefix)) {
          errors.push(
            `Function "${fn.name}": must follow {module}_{operation} convention (expected prefix "${expectedPrefix}")`
          );
        }
      }
    }

    // 6. Validate required capabilities exist in the registry
    //    (checked at staging time — may not be available at discovery)
    if (manifest.requires) {
      for (const req of manifest.requires) {
        if (!capabilityRegistry.exists(req)) {
          errors.push(
            `Required capability "${req}" not available in registry`
          );
        }
      }
    }

    // 7. Check entry point exists
    const indexPath = path.join(dir, 'index.js');
    if (!fs.existsSync(indexPath)) {
      errors.push(`Entry point not found: index.js`);
    } else {
      // 8. Check required exports (boot, teardown)
      try {
        delete require.cache[require.resolve(indexPath)];
        const mod = require(indexPath);

        if (typeof mod.boot !== 'function') {
          errors.push('Entry point missing boot(ctx) export');
        }
        if (typeof mod.teardown !== 'function') {
          errors.push('Entry point missing teardown(ctx) export');
        }

        // 9. Check all declared functions are exported
        if (manifest.functions) {
          for (const fn of manifest.functions) {
            if (typeof mod[fn.name] !== 'function') {
              errors.push(
                `Declared function "${fn.name}" not exported in index.js`
              );
            }
          }
        }
      } catch (err) {
        errors.push(`Failed to load entry point: ${err.message}`);
      }
    }
  }

  if (errors.length > 0) {
    const msg = `Validation failed for module "${module.name}":\n  - ${errors.join('\n  - ')}`;
    throw new Error(msg);
  }

  return {
    ...module,
    validated: true,
  };
}

module.exports = validate;