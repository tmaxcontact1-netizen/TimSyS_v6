'use strict';

const log = require('../services/log');
const db = require('../services/db');
const cache = require('../services/cache');
const auth = require('../services/auth');
const validate = require('../services/validate');
const events = require('../services/events');
const routeRegistry = require('../registry/routeRegistry');
const functionRegistry = require('../registry/functionRegistry');

function wireModule(registered) {
  var manifest = registered.manifest;
  var modExports = registered.exports || {};

  log.info('Wiring module "' + manifest.name + '"', { module: manifest.name });

  var ctx = {
    db: db,
    cache: cache,
    auth: auth,
    log: log,
    validate: validate,
    events: events,
    manifest: manifest,
  };

  // Wire event subscriptions
  if (manifest.events && manifest.events.subscribes) {
    manifest.events.subscribes.forEach(function(channel) {
      var handlerName = 'on_' + channel.replace(/\./g, '_');
      if (typeof modExports[handlerName] === 'function') {
        events.subscribe(channel, function(payload) {
          try {
            modExports[handlerName](payload, ctx);
          } catch (err) {
            log.error('Event handler ' + handlerName + ' failed', { error: err.message });
          }
        });
      }
    });
  }

  // Wire routes to function registry
  if (manifest.routes) {
    for (var r = 0; r < manifest.routes.length; r++) {
      var route = manifest.routes[r];
      var handlerFn = functionRegistry.get(route.handler);
      
      if (!handlerFn) {
        throw new Error(
          'Wire: handler "' + route.handler + '" not found in FunctionRegistry for module "' + manifest.name + '"'
        );
      }
    }
  }

  log.info('Wired module "' + manifest.name + '"', { module: manifest.name });

  return {
    name: registered.name,
    dir: registered.dir,
    manifest: manifest,
    exports: modExports,
    index: modExports,
    ctx: ctx,
    wired: true,
  };
}

module.exports = wireModule;