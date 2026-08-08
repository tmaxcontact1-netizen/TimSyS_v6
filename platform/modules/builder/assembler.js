'use strict';

const fs = require('fs');
const path = require('path');
const componentRegistry = require('../../shared/registry/componentRegistry');
const moduleRegistry = require('../../shared/registry/moduleRegistry');
const log = require('../../shared/services/log');

const MODULES_DIR = path.resolve(__dirname, '../../modules');

/**
 * Assemble a module from a spec.
 * Validates components, generates directory structure, writes module.json + index.js,
 * applies migrations if present.
 *
 * @param {Object} spec - Module specification
 * @param {string} spec.name - Module name
 * @param {string[]} spec.components - Required component names
 * @param {Object} [spec.routes] - Route declarations
 * @param {Object} [spec.functions] - Function declarations
 * @param {Object} [spec.schema] - Schema with tables/migrations
 * @param {Object} [spec.events] - Event subscriptions/publications
 * @returns {Object} - Assembly result
 */
function assemble(spec) {
  if (!spec || !spec.name) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'Module name is required' } };
  }

  var name = spec.name;
  var components = spec.components || [];

  // Step 1: Validate all components exist
  var missingComponent = componentRegistry.getMissing(components);
  if (missingComponent.length > 0) {
    return {
      success: false,
      statusCode: 422,
      error: {
        code: 'MISSING_COMPONENTS',
        message: 'Cannot assemble module — required components not found',
        missingComponents: missingComponent
      },
      hint: 'Register or build the missing components first, then retry assembly.'
    };
  }

  // Step 2: Check module doesn't already exist
  var moduleDir = path.join(MODULES_DIR, name);
  if (fs.existsSync(moduleDir)) {
    return {
      success: false,
      statusCode: 409,
      error: {
        code: 'MODULE_EXISTS',
        message: 'Module "' + name + '" already exists at ' + moduleDir
      }
    };
  }

  // Step 3: Auto-generate functions from routes if not provided
  var functions = spec.functions || [];
  if (functions.length === 0 && spec.routes && spec.routes.length > 0) {
    functions = spec.routes.map(function(route) {
      return {
        name: route.handler,
        exports: route.handler, // Match handler name exactly
        params: ['req', 'ctx'],
        returns: 'any'
      };
    });
  }

  // Step 4: Build manifest
  var manifest = {
    name: name,
    version: spec.version || '1.0.0',
    author: spec.author || 'admin',
    dependencies: spec.dependencies || ['db', 'cache', 'auth', 'log', 'validate', 'events'],
    provides: spec.provides || [],
    requires: spec.requires || [],
    components: components,
    routes: spec.routes || [],
    functions: functions,
    schema: spec.schema || { tables: [], migrations: [] },
    events: spec.events || { publishes: [], subscribes: [] }
  };

  // Step 5: Create directory structure
  var migrationsDir = path.join(moduleDir, 'migrations');
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  fs.writeFileSync(path.join(migrationsDir, '.gitkeep'), '');

  // Step 6: Write module.json
  fs.writeFileSync(path.join(moduleDir, 'module.json'), JSON.stringify(manifest, null, 2) + '\n');

  // Step 7: Generate index.js with component wiring and handler stubs
  var componentRequires = components.map(function(comp, idx) {
    var compData = componentRegistry.get(comp);
    var sourcePath = compData.ownerModule
      ? "'../" + compData.ownerModule + "'"
      : "'" + comp + "'";
    return "  var " + comp + " = require(" + sourcePath + "); // Component: " + compData.type;
  }).join('\n');

  var handlerStubs = functions.map(function(func) {
    var handlerName = func.name;
    return [
      'async function ' + handlerName + '(req, ctx) {',
      '  // Handler for processing requests',
      '  // Components available: ' + components.join(', '),
      '  return { success: true };',
      '}'
    ].join('\n');
  }).join('\n\n');

  var indexJs = [
    "'use strict';",
    '',
    '// Required components',
    componentRequires,
    '',
    'function boot(ctx) {',
    '  ctx.log.info("' + name + ' booting", { module: "' + name + '" });',
    '}',
    '',
    'function teardown(ctx) {',
    '  ctx.log.info("' + name + ' tearing down", { module: "' + name + '" });',
    '}',
    ''
  ];

  if (handlerStubs) {
    indexJs.push(handlerStubs);
    indexJs.push('');
  }

  var exports = ['boot: boot', 'teardown: teardown'];
  functions.forEach(function(func) {
    exports.push(func.name + ': ' + func.name);
  });

  indexJs.push('module.exports = {');
  indexJs.push('  ' + exports.join(',\n  '));
  indexJs.push('};');
  indexJs.push('');

  fs.writeFileSync(path.join(moduleDir, 'index.js'), indexJs.join('\n'));

  // Step 8: Write migrations if provided
  if (spec.schema && spec.schema.migrations) {
    spec.schema.migrations.forEach(function(migration, i) {
      var num = String(i + 1).padStart(3, '0');
      var migrationPath = path.join(migrationsDir, num + '_' + (migration.name || 'init') + '.sql');
      fs.writeFileSync(migrationPath, migration.content || '-- Migration: ' + migration.name);
      log.info('Wrote migration: ' + migrationPath, { module: name });
    });
  }

  log.info('Assembled module "' + name + '"', {
    module: name,
    components: components.length,
    routes: (spec.routes || []).length,
    functions: functions.length
  });

  return {
    success: true,
    module: {
      name: name,
      path: moduleDir,
      manifest: manifest,
      filesCreated: [
        'module.json',
        'index.js',
        'migrations/.gitkeep'
      ].concat(
        (spec.schema && spec.schema.migrations)
          ? spec.schema.migrations.map(function(m, i) {
              var num = String(i + 1).padStart(3, '0');
              return 'migrations/' + num + '_' + (m.name || 'init') + '.sql';
            })
          : []
      ),
      componentsUsed: components
    },
    nextSteps: [
      'Implement handler logic in index.js',
      'Run: node scripts/cli/migrate.js list',
      'Restart server to stage module'
    ]
  };
}

/**
 * Dry run — validate without writing files.
 * Returns what would happen if assemble() is called.
 */
function dryRun(spec) {
  if (!spec || !spec.name) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'Module name is required' } };
  }

  var components = spec.components || [];
  var missingComponents = componentRegistry.getMissing(components);
  var moduleDir = path.join(MODULES_DIR, spec.name);
  var exists = fs.existsSync(moduleDir);

  // Auto-generate functions from routes for validation
  var functions = spec.functions || [];
  if (functions.length === 0 && spec.routes && spec.routes.length > 0) {
    functions = spec.routes.map(function(route) {
      return {
        name: route.handler,
        exports: route.handler,
        params: ['req', 'ctx'],
        returns: 'any'
      };
    });
  }

  return {
    success: true,
    dryRun: true,
    module: {
      name: spec.name,
      path: moduleDir,
      wouldCreate: !exists,
      alreadyExists: exists,
      components: {
        required: components,
        available: components.filter(function(c) { return componentRegistry.exists(c); }),
        missing: missingComponents
      },
      canBuild: missingComponents.length === 0 && !exists,
      filesCreated: [
        'module.json',
        'index.js',
        'migrations/.gitkeep'
      ],
      nextSteps: [
        'Implement handler logic in index.js',
        'Run: node scripts/cli/migrate.js list',
        'Restart server to stage module'
      ]
    }
  };
}

module.exports = {
  assemble: assemble,
  dryRun: dryRun
};