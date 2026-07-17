'use strict';

const dependencyGraph = require('../registry/dependencyGraph');
const moduleRegistry = require('../registry/moduleRegistry');
const log = require('../services/log');

/**
 * Boot stage — executes module boot(ctx) hooks in dependency order.
 * Captures failures and reports status.
 *
 * Assumes all modules have been discovered, validated, registered, and wired.
 * Calls boot in topological order computed by dependencyGraph.
 *
 * @param {Array<Object>} modules - All wired modules
 * @returns {Array<{name: string, status: 'booted'|'failed', error?: string}>}
 */
function boot(modules) {
  const results = [];
  const moduleMap = new Map(modules.map((m) => [m.manifest.name, m]));

  // Compute boot order
  let bootOrder;
  try {
    bootOrder = dependencyGraph.computeBootOrder();
  } catch (err) {
    log.error('Boot order computation failed', { error: err.message });
    throw err;
  }

  // Filter to only modules we received
  const orderedModules = bootOrder
    .filter((name) => moduleMap.has(name))
    .map((name) => moduleMap.get(name));

  // Boot each module in order
  const bootedModules = [];

  for (const mod of orderedModules) {
    const { manifest, ctx, index } = mod;

    try {
      log.info(`Booting module "${manifest.name}"`, {
        module: manifest.name,
        version: manifest.version,
      });

      index.boot(ctx);
      moduleRegistry.markBooted(manifest.name);
      bootedModules.push(manifest.name);

      results.push({
        name: manifest.name,
        status: 'booted',
      });

      log.info(`Module "${manifest.name}" booted successfully`, {
        module: manifest.name,
      });
    } catch (err) {
      log.error(`Module "${manifest.name}" boot failed`, {
        module: manifest.name,
        error: err.message,
        stack: err.stack,
      });

      results.push({
        name: manifest.name,
        status: 'failed',
        error: err.message,
      });

      // Graceful rollback: tear down already-booted modules in reverse order
      log.warn(`Rolling back ${bootedModules.length} booted module(s)`, {
        failedModule: manifest.name,
      });

      const unstage = require('./unstage');
      for (let i = bootedModules.length - 1; i >= 0; i--) {
        const rollbackMod = moduleMap.get(bootedModules[i]);
        if (rollbackMod) {
          try {
            unstage(rollbackMod);
            log.info(`Rolled back module "${bootedModules[i]}"`, {
              rollbackOf: bootedModules[i],
            });
          } catch (rollbackErr) {
            log.error(`Rollback failed for module "${bootedModules[i]}"`, {
              rollbackOf: bootedModules[i],
              error: rollbackErr.message,
            });
          }
        }
      }

      throw new Error(
        `Boot failed: module "${manifest.name}" raised error: ${err.message}`
      );
    }
  }

  return results;
}

module.exports = boot;