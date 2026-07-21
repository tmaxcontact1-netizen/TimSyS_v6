'use strict';

const gapAnalysis = require('../../engine/gap-analysis');
const recommendationEngine = require('../../engine/recommendation');

function boot(ctx) {
  ctx.log.info('builder booting', { module: 'builder' });
}

function teardown(ctx) {
  ctx.log.info('builder tearing down', { module: 'builder' });
}

async function dashboard(req, ctx) {
  var completion = gapAnalysis.getPlatformCompletion();
  var recs = recommendationEngine.getSuggestions();
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
  var result = gapAnalysis.analyze(moduleName);
  return { success: true, analysis: result };
}

async function recommendations(req, ctx) {
  var intent = req.query.intent;
  var recs = recommendationEngine.getSuggestions(intent);
  return { success: true, recommendations: recs };
}

async function templates(req, ctx) {
  var templates = [
    {
      name: 'minimal',
      completionState: 25,
      description: 'Bare module.json with declarations only',
      files: ['module.json']
    },
    {
      name: 'standard',
      completionState: 50,
      description: 'Module with boot/teardown, no handlers',
      files: ['module.json', 'index.js']
    },
    {
      name: 'crud',
      completionState: 75,
      description: 'Module with CRUD handlers, missing some routes',
      files: ['module.json', 'index.js', 'migrations/001_init.sql']
    },
    {
      name: 'full',
      completionState: 100,
      description: 'Complete module with all CRUD operations, events, and schema',
      files: ['module.json', 'index.js', 'migrations/001_init.sql', 'handlers/', 'schemas/']
    }
  ];
  return { success: true, templates: templates };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  dashboard: dashboard,
  newModule: newModule,
  analysis: analysis,
  recommendations: recommendations,
  templates: templates
};
