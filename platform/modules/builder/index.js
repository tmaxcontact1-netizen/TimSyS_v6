'use strict';

const templatesModule = require('./templates');
const assembler = require('./assembler');
const composer = require('./composer');
const componentRegistry = require('../../shared/registry/componentRegistry');
const moduleRegistry = require('../../shared/registry/moduleRegistry');
const lifecycle = require('./lifecycle');

function boot(ctx) {
  ctx.log.info('builder booting', { module: 'builder' });
  templatesModule.seedDefaults();
  const defaults = ['student_registry', 'staff_registry', 'room_registry', 'inventory', 'student_profile', 'staff_profile'];
  const existing = ctx.db.query('SELECT COUNT(*) AS count FROM app_module_assignments WHERE app_id = ?', ['principal-ed']).rows[0];
  if (!existing || existing.count === 0) {
    defaults.forEach((name) => ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', ['principal-ed', name]));
  }
}

function required(value, name) {
  if (!value || typeof value !== 'string') return { error: { code: 'BAD_REQUEST', message: name + ' is required' }, statusCode: 400, success: false };
  return null;
}

async function modulesForApp(req, ctx) {
  const appId = req.query.appId;
  const invalid = required(appId, 'appId'); if (invalid) return invalid;
  const assigned = new Set(ctx.db.query('SELECT module_name FROM app_module_assignments WHERE app_id = ?', [appId]).rows.map((row) => row.module_name));
  return { success: true, data: moduleRegistry.getAll().map((mod) => ({
    ...mod, provides: mod.capabilitiesProvided, requires: mod.capabilitiesRequired, enabled: assigned.has(mod.name)
  })) };
}

async function assignModule(req, ctx) {
  const { appId, moduleName } = req.body || {};
  const invalid = required(appId, 'appId') || required(moduleName, 'moduleName'); if (invalid) return invalid;
  if (!moduleRegistry.get(moduleName)) return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Module not found' } };
  ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', [appId, moduleName]);
  return { success: true, data: { appId, moduleName, enabled: true } };
}

async function unassignModule(req, ctx) {
  const { appId, moduleName } = req.query;
  const invalid = required(appId, 'appId') || required(moduleName, 'moduleName'); if (invalid) return invalid;
  ctx.db.query('DELETE FROM app_module_assignments WHERE app_id = ? AND module_name = ?', [appId, moduleName]);
  return { success: true, data: { appId, moduleName, enabled: false } };
}

async function componentsForApp(req, ctx) {
  const appId = req.query.appId;
  const invalid = required(appId, 'appId'); if (invalid) return invalid;
  const assigned = new Set(ctx.db.query('SELECT component_name FROM app_component_assignments WHERE app_id = ?', [appId]).rows.map((row) => row.component_name));
  return { success: true, data: componentRegistry.getAll().map((component) => ({ ...component, enabled: assigned.has(component.name) })) };
}

async function assignComponent(req, ctx) {
  const { appId, componentName } = req.body || {};
  const invalid = required(appId, 'appId') || required(componentName, 'componentName'); if (invalid) return invalid;
  if (!componentRegistry.get(componentName)) return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Component not found' } };
  ctx.db.query('INSERT OR IGNORE INTO app_component_assignments (app_id, component_name) VALUES (?, ?)', [appId, componentName]);
  return { success: true, data: { appId, componentName, enabled: true } };
}

async function unassignComponent(req, ctx) {
  const { appId, componentName } = req.query;
  const invalid = required(appId, 'appId') || required(componentName, 'componentName'); if (invalid) return invalid;
  ctx.db.query('DELETE FROM app_component_assignments WHERE app_id = ? AND component_name = ?', [appId, componentName]);
  return { success: true, data: { appId, componentName, enabled: false } };
}

function teardown(ctx) {
  ctx.log.info('builder tearing down', { module: 'builder' });
}

async function dashboard(req, ctx) {
  var completion = ctx.gapAnalysis.getPlatformCompletion();
  var recs = ctx.recommendation.getSuggestions();
  return {
    success: true,
    dashboard: {
      platformCompletion: completion,
      recommendationCount: recs.suggestions.length,
      platformReadiness: recs.platformReadiness
    }
  };
}

async function newModule(req, ctx) {
  var name = req.query.name || 'unnamed_module';
  var manifest = {
    name: name,
    version: '1.0.0',
    author: 'admin',
    dependencies: ['db', 'cache', 'auth', 'log', 'validate', 'events'],
    provides: [],
    requires: [],
    routes: [],
    functions: [],
    schema: { tables: [], migrations: [] },
    events: { publishes: [], subscribes: [] }
  };
  var indexJs = [
    "'use strict';", '',
    'var moduleJson = require("./module.json");', '',
    'module.exports = {',
    '  boot(ctx) {},',
    '  teardown(ctx) {}',
    '};', ''
  ].join('\n');
  return {
    success: true,
    module: {
      manifest: manifest,
      indexJs: indexJs,
      suggestedStructure: [
        'modules/' + name + '/module.json',
        'modules/' + name + '/index.js',
        'modules/' + name + '/migrations/'
      ]
    },
    note: 'Create via: node scripts/cli/builder.js new ' + name
  };
}

async function analysis(req, ctx) {
  var moduleName = req.params.module;
  if (!moduleName) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'Module name required' } };
  }
  var result = ctx.gapAnalysis.analyze(moduleName);
  return { success: true, analysis: result };
}

async function recommendations(req, ctx) {
  var intent = req.query.intent;
  var recs = ctx.recommendation.getSuggestions(intent);
  return { success: true, recommendations: recs };
}

async function templates(req, ctx) {
  var templateList = templatesModule.getAll();
  return { success: true, templates: templateList };
}

async function assemble(req, ctx) {
  var spec = req.body || {};
  if (!spec.name) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'Module name is required' } };
  }
  var dryRun = req.query.dryRun === 'true' || req.query.dry_run === 'true';
  if (dryRun) {
    var preview = assembler.dryRun(spec);
    return preview;
  }
  var result = assembler.assemble(spec);
  return result;
}

async function components(req, ctx) {
  var all = componentRegistry.getAll();

  if (all && Array.isArray(all)) {
    return { success: true, components: all, count: all.length };
  } else {
    return { success: true, components: [], count: 0 };
  }
}

async function compose(req, ctx) {
  var input = req.body || {};
  if (!input.components || !Array.isArray(input.components) || input.components.length === 0) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'At least one component is required' } };
  }
  var result = composer.compose(input);
  return result;
}

async function validate(req, ctx) {
  var input = req.body || {};
  if (!input.components || !Array.isArray(input.components) || input.components.length === 0) {
    return { success: false, statusCode: 400, error: { code: 'BAD_REQUEST', message: 'At least one component is required' } };
  }

  var composed = composer.compose(input);
  if (!composed.success) {
    return {
      success: true,
      validated: {
        canBuild: false,
        composition: composed,
        assemblyPreview: null,
        errors: composed.error || composed.errors || ['Composition failed']
      }
    };
  }

  var assemblyPreview = assembler.dryRun({
    name: input.name || 'test-module',
    components: input.components
  });

  return {
    success: true,
    validated: {
      canBuild: true,
      composition: composed,
      assemblyPreview: assemblyPreview
    }
  };
}

async function drafts() {
  return { success: true, data: lifecycle.listDrafts() };
}

async function activateDraft(req) {
  const name = req.params && req.params.module;
  const invalid = required(name, 'module'); if (invalid) return invalid;
  const result = lifecycle.activate(name);
  if (!result.valid) return { success: false, statusCode: 422, error: { code: 'MODULE_NOT_READY', message: 'Draft module cannot be activated', details: result.errors } };
  return { success: true, data: { name, status: 'active', restartRequired: true } };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  dashboard: dashboard,
  newModule: newModule,
  analysis: analysis,
  recommendations: recommendations,
  templates: templates,
  assemble: assemble,
  components: components,
  compose: compose,
  validate: validate, drafts, activateDraft,
  modulesForApp, assignModule, unassignModule, componentsForApp, assignComponent, unassignComponent
};
