'use strict';

const componentRegistry = require('../../shared/registry/componentRegistry');
const uiStandard = require('./ui-standard');
const log = require('../../shared/services/log');

/**
 * Compose a module spec from a list of components.
 * Merges component metadata, detects conflicts, generates routes/functions/schema.
 *
 * @param {Object} input - Composition request
 * @param {string} input.name - Module name
 * @param {string[]} input.components - Component names to include
 * @param {Array<Object>} [input.routes] - Optional route overrides
 * @param {string} [input.version] - Version string
 * @param {string} [input.author] - Author
 * @param {Object} [input.statusConfig] - Status action configuration
 * @returns {Object} Composition result with spec
 */
function compose(input) {
  if (!input || !input.name) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'BAD_REQUEST', message: 'Module name is required' }
    };
  }

  if (!input.components || !Array.isArray(input.components) || input.components.length === 0) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'BAD_REQUEST', message: 'At least one component is required' }
    };
  }

  var name = input.name;
  var componentNames = input.components;

  // Step 1: Validate all components exist
  var missing = componentRegistry.getMissing(componentNames);
  if (missing.length > 0) {
    return {
      success: false,
      statusCode: 422,
      error: {
        code: 'MISSING_COMPONENTS',
        message: 'Cannot compose module — required components not found',
        missingComponents: missing
      }
    };
  }

  // Step 2: Collect component data
  var componentData = componentNames.map(function(cn) {
    return componentRegistry.get(cn);
  });
  var uncertified = componentData.filter(function(component) { return !component.certification || component.certification.status !== 'certified'; });
  if (uncertified.length) return { success:false, statusCode:422, error:{ code:'UNCERTIFIED_COMPONENTS', message:'Only certified components can be composed into modules', components:uncertified.map(function(component) { return component.name; }) } };

  // Step 3: Merge dependencies
  var dependencies = new Set(['db', 'cache', 'auth', 'log', 'validate', 'events']);
  var requires = [];
  var warnings = [];
  var conflicts = [];

  componentData.forEach(function(comp) {
    if (comp.ownerModule) {
      dependencies.add(comp.ownerModule);
    }

    if (comp.dependencies) {
      comp.dependencies.forEach(function(dep) {
        requires.push(dep);
        dependencies.add(dep);
      });
    }
  });

  var uniqueRequires = Array.from(new Set(requires));
  var dependencyList = Array.from(dependencies);

  // Step 4: Merge schema (collect tables from all components)
  var schemaTables = [];
  var tableOwners = {};
  var schemaMigrations = [];

  componentData.forEach(function(comp) {
    if (comp.schema && comp.schema.tables) {
      comp.schema.tables.forEach(function(table) {
        if (schemaTables.indexOf(table) !== -1) {
          conflicts.push({
            type: 'table',
            details: 'Duplicate table "' + table + '" from component "' + comp.name + '"'
          });
        } else {
          schemaTables.push(table);
          tableOwners[table] = comp.ownerModule || comp.name;
        }
      });
    }

    if (comp.schema && comp.schema.migrations) {
      comp.schema.migrations.forEach(function(mig) {
        if (schemaMigrations.indexOf(mig) === -1) {
          schemaMigrations.push(mig);
        }
      });
    }
  });

  // Step 5: Merge capabilities
  var provides = [];
  componentData.forEach(function(comp) {
    if (comp.capabilities) {
      if (Array.isArray(comp.capabilities)) {
        comp.capabilities.forEach(function(cap) {
          if (provides.indexOf(cap) === -1) {
            provides.push(cap);
          }
        });
      }
    }
  });

  // Step 6: Merge events
  var publishes = [];
  var subscribes = [];

  componentData.forEach(function(comp) {
    if (comp.events) {
      if (comp.events.publishes) {
        comp.events.publishes.forEach(function(evt) {
          if (publishes.indexOf(evt) === -1) publishes.push(evt);
        });
      }
      if (comp.events.subscribes) {
        comp.events.subscribes.forEach(function(evt) {
          if (subscribes.indexOf(evt) === -1) subscribes.push(evt);
        });
      }
    }
  });

  // Step 7: Generate or accept routes
  var routes;
  if (input.routes && Array.isArray(input.routes) && input.routes.length > 0) {
    routes = input.routes;
  } else {
    routes = generateCrudRoutes(name, componentNames);
  }

  // Step 7a: Detect route conflicts within provided routes
  var routeKeys = {};
  routes.forEach(function(r) {
    var key = r.method.toUpperCase() + ' ' + r.path;
    if (routeKeys[key]) {
      conflicts.push({
        type: 'route',
        details: 'Duplicate route "' + key + '"'
      });
    }
    routeKeys[key] = true;
  });

  // Step 8: Generate function declarations
  var functions = routes.map(function(r) {
    return {
      name: r.handler,
      exports: r.handler.replace(/^.*_/, ''),
      params: ['req', 'ctx'],
      returns: 'any'
    };
  });

  // Step 9: Build manifest
  var manifest = uiStandard.applyToManifest({
    name: name,
    version: input.version || '1.0.0',
    author: input.author || 'admin',
    dependencies: dependencyList,
    provides: provides,
    requires: uniqueRequires,
    components: componentNames,
    insights: input.insights || { classification:'composite_operational', platform:{heartbeat:true,health:true,usage:true,performance:true,dependencies:true}, operational:{enabled:true,advisoryOnly:true,evidenceRequired:true}, visibility:{principal:'summary',superuser:'detailed',developer:'diagnostic'}, inherited:true },
    routes: routes,
    functions: functions,
    statusConfig: input.statusConfig || null,
    schema: {
      tables: [],
      migrations: []
    },
    events: {
      publishes: publishes,
      subscribes: subscribes
    }
  });

  // No schema inheritance — composite modules reference tables owned by components
  schemaTables = [];
  schemaMigrations = [];

  log.info('Composed module "' + name + '"', {
    components: componentNames.length,
    routes: routes.length,
    conflicts: conflicts.length
  });

  return {
    success: true,
    spec: {
      manifest: manifest,
      conflicts: conflicts,
      warnings: warnings,
      components: componentData.map(function(c) {
        return {
          name: c.name,
          type: c.type,
          ownerModule: c.ownerModule
        };
      })
    }
  };
}

/**
 * Generate standard CRUD routes for a module name.
 * GET /<resource> — list
 * POST /<resource> — create
 * GET /<resource>/:id — read
 * PUT /<resource>/:id — update
 * PUT /<resource>/:id/withdraw — soft-delete (status change)
 * PUT /<resource>/:id/reinstate — restore active status
 * DELETE /<resource>/:id/permanent — hard delete (requires withdrawn or ?force=true)
 */
function generateCrudRoutes(moduleName, componentNames) {
  var resourcePath = '/' + moduleName.replace(/_/g, '-').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  var baseHandler = moduleName.replace(/[-_]/g, '_');

  return [
    { path: resourcePath, method: 'GET', handler: baseHandler + '_list', auth_required: true },
    { path: resourcePath, method: 'POST', handler: baseHandler + '_create', auth_required: true },
    { path: resourcePath + '/:id', method: 'GET', handler: baseHandler + '_read', auth_required: true },
    { path: resourcePath + '/:id', method: 'PUT', handler: baseHandler + '_update', auth_required: true },
    { path: resourcePath + '/:id/withdraw', method: 'PUT', handler: baseHandler + '_withdraw', auth_required: true },
    { path: resourcePath + '/:id/reinstate', method: 'PUT', handler: baseHandler + '_reinstate', auth_required: true },
    { path: resourcePath + '/:id/permanent', method: 'DELETE', handler: baseHandler + '_permanentDelete', auth_required: true }
  ];
}

module.exports = {
  compose: compose,
  generateCrudRoutes: generateCrudRoutes
};
