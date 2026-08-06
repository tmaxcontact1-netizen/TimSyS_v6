'use strict';

const moduleRegistry = require('../registry/moduleRegistry');
const routeRegistry = require('../registry/routeRegistry');
const functionRegistry = require('../registry/functionRegistry');
const capabilityRegistry = require('../registry/capabilityRegistry');
const schemaRegistry = require('../registry/schemaRegistry');
const dependencyGraph = require('../registry/dependencyGraph');
const cache = require('../services/cache');
const log = require('../services/log');
const events = require('../services/events');

/**
 * Unstage — gracefully deregisters a module.
 * Reverse of staging: teardown hook → remove routes → unregister functions
 * → unregister capabilities → unregister schemas → remove from dependency graph
 * → invalidate cache entries.
 *
 * @param {Object} module - Wired module with ctx and index
 */
function unstage(module) {
  const { manifest, ctx, index } = module;

  log.info(`Unstaging module "${manifest.name}"`, {
    module: manifest.name,
  });

  // 1. Execute teardown hook
  if (ctx && index && typeof index.teardown === 'function') {
    try {
      index.teardown(ctx);
    } catch (err) {
      log.error(`Teardown hook failed for "${manifest.name}"`, {
        module: manifest.name,
        error: err.message,
      });
      // Continue with cleanup anyway
    }
  }

  // 2. Remove routes
  if (manifest.routes) {
    for (const route of manifest.routes) {
      try {
        routeRegistry.unregister(route.path, route.method.toUpperCase());
      } catch (err) {
        log.error(`Failed to unregister route "${route.method} ${route.path}"`, {
          module: manifest.name,
          error: err.message,
        });
      }
    }
  }

  // 3. Unregister functions
  if (manifest.functions) {
    for (const fn of manifest.functions) {
      try {
        functionRegistry.unregister(fn.name);
      } catch (err) {
        log.error(`Failed to unregister function "${fn.name}"`, {
          module: manifest.name,
          error: err.message,
        });
      }
    }
  }

  // 4. Unregister capabilities
  if (manifest.provides) {
    for (const cap of manifest.provides) {
      try {
        capabilityRegistry.unregister(cap);
      } catch (err) {
        log.error(`Failed to unregister capability "${cap}"`, {
          module: manifest.name,
          error: err.message,
        });
      }
    }
  }

  // 5. Unregister schemas
  if (manifest.schema && manifest.schema.tables) {
    for (const table of manifest.schema.tables) {
      try {
        schemaRegistry.unregister(table);
      } catch (err) {
        log.error(`Failed to unregister schema "${table}"`, {
          module: manifest.name,
          error: err.message,
        });
      }
    }
  }

  // 6. Remove from dependency graph
  dependencyGraph.removeModule(manifest.name);

  // 7. Invalidate cache entries for this module
  cache.invalidate(`${manifest.name}:*`);

  // 8. Deregister from module registry
  moduleRegistry.deregister(manifest.name);

  log.info(`Module "${manifest.name}" unstaged`, {
    module: manifest.name,
  });
}

module.exports = unstage;