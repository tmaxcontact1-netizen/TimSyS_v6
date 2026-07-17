'use strict';

var moduleRegistry = require('../registry/moduleRegistry');
var schemaRegistry = require('../registry/schemaRegistry');
var routeRegistry = require('../registry/routeRegistry');
var functionRegistry = require('../registry/functionRegistry');
var capabilityRegistry = require('../registry/capabilityRegistry');
var dependencyGraph = require('../registry/dependencyGraph');

function register(module) {
  var manifest = module.manifest;
  var dir = module.dir;

  var indexPath = require('path').join(dir, 'index.js');
  delete require.cache[require.resolve(indexPath)];
  var index = require(indexPath);

  moduleRegistry.register(manifest);

  if (manifest.provides) {
    for (var i = 0; i < manifest.provides.length; i++) {
      capabilityRegistry.register(manifest.provides[i], manifest.name);
    }
  }

  if (manifest.functions) {
    for (var j = 0; j < manifest.functions.length; j++) {
      var fn = manifest.functions[j];
      if (typeof index[fn.name] === 'function') {
        functionRegistry.register(fn.name, manifest.name, index[fn.name], {
          params: fn.params || [],
          returns: fn.returns || null,
        });
      }
    }
  }

  if (manifest.routes) {
    for (var k = 0; k < manifest.routes.length; k++) {
      var route = manifest.routes[k];
      routeRegistry.register({
        path: route.path,
        method: route.method.toUpperCase(),
        handler: route.handler,
        auth_required: route.auth || false,
        moduleName: manifest.name,
      });
    }
  }

  if (manifest.schema && manifest.schema.tables) {
    for (var t = 0; t < manifest.schema.tables.length; t++) {
      schemaRegistry.register(
        manifest.schema.tables[t],
        manifest.name,
        manifest.schema.migrations || []
      );
    }
  }

  dependencyGraph.addModule(manifest.name, manifest.dependencies || []);

  var result = Object.assign({}, module, { index: index, registered: true });
  return result;
}

module.exports = register;