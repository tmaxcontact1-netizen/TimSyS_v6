'use strict';

const routeRegistry = require('../registry/routeRegistry');
const functionRegistry = require('../registry/functionRegistry');
const cache = require('../services/cache');
const log = require('../services/log');
const db = require('../services/db');
const auth = require('../services/auth');
const validate = require('../services/validate');
const events = require('../services/events');

/**
 * Wire stage — connects routes to handlers, injects dependencies,
 * and sets up event subscriptions. Constructs the Context object.
 *
 * @param {Object} module - Registered module with index loaded
 * @returns {Object} Wired module with context
 */
function wire(module) {
  const { manifest, index } = module;

  // 1. Build the Context object — sole legal channel to services
  const ctx = {
    db,
    cache,
    auth,
    log,
    validate,
    events,
    module: {
      name: manifest.name,
      version: manifest.version,
      capabilities: manifest.provides || [],
      dependencies: manifest.dependencies || [],
    },
  };

  // 2. Verify route handlers exist and are callable
  if (manifest.routes) {
    for (const route of manifest.routes) {
      const handlerFn = functionRegistry.get(route.handler);
      if (!handlerFn) {
        throw new Error(
          `Wire: handler "${route.handler}" not found in FunctionRegistry for module "${manifest.name}"`
        );
      }
    }
  }

  // 3. Set up event subscriptions
  if (manifest.events && manifest.events.subscribes) {
    for (const channel of manifest.events.subscribes) {
      // Look for a handler named on_<channel> in the module index
      const handlerName = `on_${channel.replace(/\./g, '_')}`;
      if (typeof index[handlerName] === 'function') {
        events.subscribe(channel, (payload) => {
          try {
            index[handlerName](payload, ctx);
          } catch (err) {
            log.error(`Event handler "${handlerName}" failed`, {
              module: manifest.name,
              channel,
              error: err.message,
            });
          }
        });
        log.info(`Subscribed to event channel "${channel}"`, {
          module: manifest.name,
        });
      } else {
        log.warn(`No handler "${handlerName}" for subscribed channel "${channel}"`, {
          module: manifest.name,
        });
      }
    }
  }

  return {
    ...module,
    ctx,
    wired: true,
  };
}

module.exports = wire;