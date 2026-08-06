'use strict';

const templatesModule = require('./templates');
const assembler = require('./assembler');
const composer = require('./composer');

function boot(ctx) {
  ctx.log.info('builder booting', { module: 'builder' });
  templatesModule.seedDefaults();
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
  var all = composer.listComponents ? 
    await Promise.resolve(composer.listComponents()) :
    componentRegistry.getAll();
  
  // Get actual registry if composer doesn't export listComponents
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
  
  // First compose to get the spec
  var composed = composer.compose(input);
  if (!composed.success) {
    return composed;
  }
  
  // Then dry-run assemble
  var assemblyPreview = assembler.dryRun({
    name: input.name || 'test-module',
    components: input.components
  });
  
  return {
    success: true,
    validated: {
      composition: composed,
      assemblyPreview: assemblyPreview
    }
  };
}

// Expose componentRegistry for handlers
const componentRegistry = require('../../shared/registry/componentRegistry');

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
  validate: validate
};