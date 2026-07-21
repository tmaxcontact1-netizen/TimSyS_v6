'use strict';

const fs = require('fs');
const path = require('path');
const log = require('../services/log');

var REQUIRED_FIELDS = ['name', 'version', 'author', 'dependencies', 'provides', 'requires', 'routes', 'functions', 'schema', 'events'];
var VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function validateModule(moduleInfo) {
  var manifest = moduleInfo.manifest;
  var errors = [];

  // Check required fields
  for (var i = 0; i < REQUIRED_FIELDS.length; i++) {
    if (!(REQUIRED_FIELDS[i] in manifest)) {
      errors.push('Missing required field: ' + REQUIRED_FIELDS[i]);
    }
  }

  // Check name format (lowercase, underscores)
  if (manifest.name && !/^[a-z][a-z0-9_]*$/.test(manifest.name)) {
    errors.push('Module name must be lowercase letters, numbers, and underscores only');
  }

  // Check version (semver)
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    errors.push('Version must follow semver (e.g. 1.0.0)');
  }

  // Check entry point exists
  var indexPath = path.join(moduleInfo.dir, 'index.js');
  if (!fs.existsSync(indexPath)) {
    errors.push('Entry point index.js not found');
  } else {
    // Load module and check exports
    var modExports;
    try {
      delete require.cache[require.resolve(indexPath)];
      modExports = require(indexPath);
    } catch (err) {
      errors.push('Failed to load index.js: ' + err.message);
      modExports = {};
    }

    // Check boot and teardown exports
    if (!modExports.boot || typeof modExports.boot !== 'function') {
      errors.push('Missing "boot" export in index.js');
    }
    if (!modExports.teardown || typeof modExports.teardown !== 'function') {
      errors.push('Missing "teardown" export in index.js');
    }

    // Check function naming convention and exports
    if (manifest.functions) {
      for (var f = 0; f < manifest.functions.length; f++) {
        var func = manifest.functions[f];

        // Check naming convention: {module}_{operation}
        var expectedPrefix = manifest.name + '_';
        if (func.name && !func.name.startsWith(expectedPrefix)) {
          errors.push('Function "' + func.name + '": must follow {module}_{operation} convention (expected prefix "' + expectedPrefix + '")');
        }

        // Check that the declared export exists
        var exportName = func.exports || func.name;
        if (modExports[exportName] === undefined) {
          errors.push('Declared function "' + func.name + '" not exported in index.js');
        }
      }
    }
  }

  // Check routes
  if (manifest.routes) {
    for (var r = 0; r < manifest.routes.length; r++) {
      var route = manifest.routes[r];

      if (!route.path || typeof route.path !== 'string') {
        errors.push('Route ' + r + ': missing or invalid "path"');
      }

      if (!route.method || VALID_METHODS.indexOf(route.method.toUpperCase()) === -1) {
        errors.push('Route ' + r + ': invalid method "' + route.method + '"');
      }

      if (!route.handler || typeof route.handler !== 'string') {
        errors.push('Route ' + r + ': missing or invalid "handler"');
      }
    }
  }

  // Check events structure
  if (manifest.events) {
    if (!Array.isArray(manifest.events.publishes)) {
      errors.push('events.publishes must be an array');
    }
    if (!Array.isArray(manifest.events.subscribes)) {
      errors.push('events.subscribes must be an array');
    }
  }

  if (errors.length > 0) {
    throw new Error('Validation failed for module "' + manifest.name + '":\n  - ' + errors.join('\n  - '));
  }

  log.info('Validated module "' + manifest.name + '"', { module: manifest.name });

  return {
    name: moduleInfo.name,
    dir: moduleInfo.dir,
    manifest: manifest,
    validated: true,
  };
}

module.exports = validateModule;