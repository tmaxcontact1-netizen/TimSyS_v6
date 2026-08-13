'use strict';

const path = require('path');
const log = require('../services/log');
const moduleRegistry = require('../registry/moduleRegistry');
const routeRegistry = require('../registry/routeRegistry');
const functionRegistry = require('../registry/functionRegistry');
const capabilityRegistry = require('../registry/capabilityRegistry');
const schemaRegistry = require('../registry/schemaRegistry');
const dependencyGraph = require('../registry/dependencyGraph');

function registerModule(moduleInfo) {
  var manifest = moduleInfo.manifest;
  var indexPath = path.join(moduleInfo.dir, 'index.js');

  log.info('Registering module "' + manifest.name + '"', { module: manifest.name });

  delete require.cache[require.resolve(indexPath)];
  var modExports = require(indexPath);

  // Keep the complete manifest available to introspection and the Builder.
  // Previously this reduced record discarded dependencies, routes, functions,
  // schema and capabilities, making registered modules appear empty.
  moduleRegistry.register(manifest);

  if (manifest.routes) {
    for (var r = 0; r < manifest.routes.length; r++) {
      var route = manifest.routes[r];

      var routeObj = {
        path: route.path,
        method: route.method.toUpperCase(),
        handler: route.handler,
        auth_required: route.auth_required !== undefined ? route.auth_required : (route.auth || false),
        moduleName: manifest.name,
      };

      if (route.permissions && Array.isArray(route.permissions)) {
        routeObj.permissions = route.permissions;
      }

      routeRegistry.register(routeObj);
    }
  }

  if (manifest.functions) {
    for (var f = 0; f < manifest.functions.length; f++) {
      var func = manifest.functions[f];
      var exportName = func.exports || func.name;
      var implementation = modExports[exportName];

      if (implementation) {
        functionRegistry.register(func.name, manifest.name, implementation, {
          params: func.params || [],
          returns: func.returns || 'any',
        });
      }
    }
  }

  if (manifest.provides) {
    for (var c = 0; c < manifest.provides.length; c++) {
      capabilityRegistry.register(manifest.provides[c], manifest.name);
    }
  }

  if (manifest.schema && manifest.schema.tables) {
    for (var t = 0; t < manifest.schema.tables.length; t++) {
      var tableName = manifest.schema.tables[t];
      var migrations = manifest.schema.migrations || [];
      schemaRegistry.register(tableName, manifest.name, migrations);
    }
  }

  dependencyGraph.addModule(manifest.name, manifest.dependencies || []);

  log.info('Registered module "' + manifest.name + '"', { module: manifest.name });

  return {
    name: moduleInfo.name,
    dir: moduleInfo.dir,
    manifest: manifest,
    exports: modExports,
    registered: true,
  };
}

module.exports = registerModule;
