'use strict';

const templatesModule = require('./templates');
const assembler = require('./assembler');
const composer = require('./composer');
const componentRegistry = require('../../shared/registry/componentRegistry');
const moduleRegistry = require('../../shared/registry/moduleRegistry');
const lifecycle = require('./lifecycle');
const uiStandard = require('./ui-standard');
const appCatalog = require('./app-catalog');

function boot(ctx) {
  ctx.log.info('builder booting', { module: 'builder' });
  templatesModule.seedDefaults();
  const defaults = ['student_registry', 'staff_registry', 'room_registry', 'inventory', 'student_profile', 'staff_profile', 'calendar', 'ownership', 'tasks', 'approvals', 'documents', 'communications', 'audiences', 'invitations', 'attendance', 'venue_bookings', 'resource_reservations', 'transportation', 'catering', 'risk_assessments', 'safeguarding_requirements', 'medical_referrals', 'contingency', 'financial_planning', 'event_record', 'event_planner'];
  const existing = ctx.db.query('SELECT COUNT(*) AS count FROM app_module_assignments WHERE app_id = ?', ['principal-ed']).rows[0];
  if (!existing || existing.count === 0) {
    defaults.forEach((name) => ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', ['principal-ed', name]));
  }
  ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', ['principal-ed', 'calendar']);
  ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', ['principal-ed', 'ownership']);
  ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', ['principal-ed', 'tasks']);
  ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', ['principal-ed', 'approvals']);
  ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', ['principal-ed', 'documents']);
  ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', ['principal-ed', 'communications']);
  ['audiences','invitations','attendance','venue_bookings','resource_reservations','transportation','catering','risk_assessments','safeguarding_requirements','medical_referrals','contingency','financial_planning','event_record','event_planner'].forEach((name) => ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', ['principal-ed', name]));
  componentRegistry.getAll().forEach(function(component) {
    if (defaults.includes(component.ownerModule)) ctx.db.query('INSERT OR IGNORE INTO app_component_assignments (app_id, component_name) VALUES (?, ?)', ['principal-ed', component.name]);
  });
  ['competeed', 'sanctifyed'].forEach(function(appId) {
    ['room_registry', 'inventory'].forEach(function(name) { ctx.db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', [appId, name]); });
    componentRegistry.getAll().filter(function(component) { return ['room_registry', 'inventory'].includes(component.ownerModule); }).forEach(function(component) {
      ctx.db.query('INSERT OR IGNORE INTO app_component_assignments (app_id, component_name) VALUES (?, ?)', [appId, component.name]);
    });
  });
}

function required(value, name) {
  if (!value || typeof value !== 'string') return { error: { code: 'BAD_REQUEST', message: name + ' is required' }, statusCode: 400, success: false };
  return null;
}

function knownApp(appId) {
  return appCatalog.get(appId) ? null : { error: { code: 'UNKNOWN_ADMIN_APP', message: 'Unknown admin application' }, statusCode: 404, success: false };
}

function canManageProfiles(req) {
  const permissions = (req.user && req.user.permissions) || [];
  return permissions.includes('admin:*') || permissions.some(function(permission) { return permission.indexOf('admin:principal') === 0; });
}

function isProfile(value) { return String(value || '').indexOf('_profile') !== -1; }

function moduleDependents(moduleName, assigned) {
  const removed = moduleRegistry.get(moduleName);
  const provisions = new Set((removed && removed.capabilitiesProvided) || []);
  return moduleRegistry.getAll().filter(function(mod) {
    if (mod.name === moduleName || !assigned.has(mod.name)) return false;
    return (mod.dependencies || []).includes(moduleName) || (mod.capabilitiesRequired || []).some(function(capability) { return provisions.has(capability); });
  }).map(function(mod) { return mod.name; });
}

function decorateModule(mod, assigned, appId) {
  const components = componentRegistry.getByModule(mod.name);
  const requiredModule = ['inventory', 'room_registry'].includes(mod.name);
  return Object.assign({}, mod, {
    provides: mod.capabilitiesProvided || [], requires: mod.capabilitiesRequired || [], enabled: assigned.has(mod.name),
    components: components,
    componentManifest: components,
    removalImpact: moduleDependents(mod.name, assigned),
    profileAccess: isProfile(mod.name) ? ['superuser', 'principal'] : null,
    required: requiredModule,
    removable: !requiredModule
  });
}

async function modulesForApp(req, ctx) {
  const appId = req.query.appId;
  const invalid = required(appId, 'appId'); if (invalid) return invalid;
  const unknown = knownApp(appId); if (unknown) return unknown;
  const assigned = new Set(ctx.db.query('SELECT module_name FROM app_module_assignments WHERE app_id = ?', [appId]).rows.map((row) => row.module_name));
  return { success: true, data: moduleRegistry.getAll().map(function(mod) { return decorateModule(mod, assigned, appId); }) };
}

async function assignModule(req, ctx) {
  const { appId, moduleName } = req.body || {};
  const invalid = required(appId, 'appId') || required(moduleName, 'moduleName'); if (invalid) return invalid;
  const unknown = knownApp(appId); if (unknown) return unknown;
  if (isProfile(moduleName) && !canManageProfiles(req)) return { success: false, statusCode: 403, error: { code: 'PROFILE_ACCESS_RESTRICTED', message: 'User profiles can only be configured by a superuser or principal' } };
  const selected = moduleRegistry.get(moduleName);
  if (!selected) return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Module not found' } };
  const providers = [];
  (selected.capabilitiesRequired || []).forEach(function(capability) {
    const provider = moduleRegistry.getAll().find(function(mod) { return (mod.capabilitiesProvided || []).includes(capability); });
    if (provider && !providers.includes(provider.name)) providers.push(provider.name);
  });
  ctx.db.transaction(function(db) {
    providers.concat([moduleName]).forEach(function(name) { db.query('INSERT OR IGNORE INTO app_module_assignments (app_id, module_name) VALUES (?, ?)', [appId, name]); });
  });
  return { success: true, data: { appId, moduleName, enabled: true, dependenciesAdded: providers } };
}

async function unassignModule(req, ctx) {
  const { appId, moduleName } = req.query;
  const invalid = required(appId, 'appId') || required(moduleName, 'moduleName'); if (invalid) return invalid;
  const unknown = knownApp(appId); if (unknown) return unknown;
  if (isProfile(moduleName) && !canManageProfiles(req)) return { success: false, statusCode: 403, error: { code: 'PROFILE_ACCESS_RESTRICTED', message: 'User profiles can only be configured by a superuser or principal' } };
  if (['inventory', 'room_registry'].includes(moduleName)) return { success: false, statusCode: 409, error: { code: 'REQUIRED_BASELINE', message: 'Places and Stuff are required baseline modules' } };
  const assigned = new Set(ctx.db.query('SELECT module_name FROM app_module_assignments WHERE app_id = ?', [appId]).rows.map(function(row) { return row.module_name; }));
  const affected = moduleDependents(moduleName, assigned);
  if (affected.length) return { success: false, statusCode: 409, error: { code: 'DEPENDENCY_IMPACT', message: 'Remove dependent modules first', affected: affected } };
  ctx.db.query('DELETE FROM app_module_assignments WHERE app_id = ? AND module_name = ?', [appId, moduleName]);
  return { success: true, data: { appId, moduleName, enabled: false } };
}

async function componentsForApp(req, ctx) {
  const appId = req.query.appId;
  const invalid = required(appId, 'appId'); if (invalid) return invalid;
  const unknown = knownApp(appId); if (unknown) return unknown;
  const assigned = new Set(ctx.db.query('SELECT component_name FROM app_component_assignments WHERE app_id = ?', [appId]).rows.map((row) => row.component_name));
  return { success: true, data: componentRegistry.getAll().map((component) => ({ ...component, enabled: assigned.has(component.name) })) };
}

async function assignComponent(req, ctx) {
  const { appId, componentName } = req.body || {};
  const invalid = required(appId, 'appId') || required(componentName, 'componentName'); if (invalid) return invalid;
  const unknown = knownApp(appId); if (unknown) return unknown;
  if (isProfile(componentName) && !canManageProfiles(req)) return { success: false, statusCode: 403, error: { code: 'PROFILE_ACCESS_RESTRICTED', message: 'User profiles can only be configured by a superuser or principal' } };
  if (!componentRegistry.get(componentName)) return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Component not found' } };
  ctx.db.query('INSERT OR IGNORE INTO app_component_assignments (app_id, component_name) VALUES (?, ?)', [appId, componentName]);
  return { success: true, data: { appId, componentName, enabled: true } };
}

async function unassignComponent(req, ctx) {
  const { appId, componentName } = req.query;
  const invalid = required(appId, 'appId') || required(componentName, 'componentName'); if (invalid) return invalid;
  const unknown = knownApp(appId); if (unknown) return unknown;
  if (isProfile(componentName) && !canManageProfiles(req)) return { success: false, statusCode: 403, error: { code: 'PROFILE_ACCESS_RESTRICTED', message: 'User profiles can only be configured by a superuser or principal' } };
  const component = componentRegistry.get(componentName);
  if (component && ['inventory', 'room_registry'].includes(component.ownerModule)) return { success: false, statusCode: 409, error: { code: 'REQUIRED_BASELINE', message: 'Places and Stuff are required baseline components' } };
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

async function catalogue(req, ctx) {
  const apps = appCatalog.all().map(function(app) {
    const assigned = new Set(ctx.db.query('SELECT module_name FROM app_module_assignments WHERE app_id = ?', [app.id]).rows.map(function(row) { return row.module_name; }));
    const assignedComponents = new Set(ctx.db.query('SELECT component_name FROM app_component_assignments WHERE app_id = ?', [app.id]).rows.map(function(row) { return row.component_name; }));
    const visibleModules = app.id === 'principal-ed' ? moduleRegistry.getAll() : moduleRegistry.getAll().filter(function(mod) { return assigned.has(mod.name); });
    const modules = visibleModules.map(function(mod) {
      const decorated = decorateModule(mod, assigned, app.id);
      decorated.components = decorated.components.map(function(component) {
        const requiredComponent = ['room_registry', 'inventory'].includes(component.ownerModule);
        return Object.assign({}, component, { enabled: assignedComponents.has(component.name), removalImpact: [], required: requiredComponent, removable: !requiredComponent });
      });
      decorated.componentManifest = decorated.components;
      return decorated;
    });
    return Object.assign({}, app, {
      essentialServices: appCatalog.essentialServices(),
      modules: modules
    });
  });
  return { success: true, data: { apps: apps, scope: 'app-specific', excludedApplications: ['memecoined'], profileAccess: ['superuser', 'principal'], recommendations: ctx.recommendation.getSuggestions() } };
}

async function applicationUiStandard() {
  return { success: true, standard: uiStandard.contract };
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
      assemblyPreview: assemblyPreview,
      uiStandard: uiStandard.validateDeclaration(composed.spec.manifest.uiStandard)
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
  catalogue: catalogue,
  templates: templates,
  applicationUiStandard: applicationUiStandard,
  assemble: assemble,
  components: components,
  compose: compose,
  validate: validate, drafts, activateDraft,
  modulesForApp, assignModule, unassignModule, componentsForApp, assignComponent, unassignComponent
};
