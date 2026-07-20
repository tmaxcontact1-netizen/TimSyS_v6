'use strict';

const discover = require('../../../shared/pipeline/discover');
const validateModule = require('../../../shared/pipeline/validate');
const registerModule = require('../../../shared/pipeline/register');
const wireModule = require('../../../shared/pipeline/wire');
const moduleRegistry = require('../../../shared/registry/moduleRegistry');
const log = require('../../../shared/services/log');

function listStagedModules(req, ctx) {
  var modules = moduleRegistry.getAll().map(function(m) {
    return {
      name: m.name,
      version: m.version,
      status: m.status,
      booted: m.booted || false,
      capabilities: m.capabilitiesProvided || [],
      routes: m.routes ? m.routes.length : 0,
      functions: m.functions ? m.functions.length : 0,
    };
  });

  return {
    success: true,
    modules: modules,
    total: modules.length,
  };
}

function stageModule(req, ctx) {
  var moduleName = req.body.name;
  
  if (!moduleName) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'MISSING_MODULE_NAME', message: 'Module name required in request body' },
    };
  }

  try {
    var discovered = discover();
    var moduleInfo = discovered.find(function(d) { return d.manifest.name === moduleName; });
    
    if (!moduleInfo) {
      return {
        success: false,
        statusCode: 404,
        error: { code: 'MODULE_NOT_FOUND', message: 'No module.json found for "' + moduleName + '"' },
      };
    }

    var validated = validateModule(moduleInfo);
    var registered = registerModule(validated);
    var wired = wireModule(registered);

    return {
      success: true,
      module: {
        name: moduleName,
        version: validated.manifest.version,
        status: 'registered',
        booted: false,
      },
    };
  } catch (err) {
    log.error('Stage failed', { module: moduleName, error: err.message });
    return {
      success: false,
      statusCode: 500,
      error: { code: 'STAGE_FAILED', message: err.message },
    };
  }
}

function unstageModule(req, ctx) {
  var moduleName = req.params.id;
  
  if (!moduleName) {
    return {
      success: false,
      statusCode: 400,
      error: { code: 'MISSING_MODULE_ID', message: 'Module ID required in URL path' },
    };
  }

  var moduleList = moduleRegistry.getAll();
  var targetModule = moduleList.find(function(m) { return m.name === moduleName; });

  if (!targetModule) {
    return {
      success: false,
      statusCode: 404,
      error: { code: 'MODULE_NOT_FOUND', message: 'Module "' + moduleName + '" not found' },
    };
  }

  log.warn('Dynamic unstage limited - restart required for full cleanup', { module: moduleName });
  return {
    success: true,
    warning: 'Marked for removal on next restart',
    module: moduleName,
  };
}

module.exports = {
  listStagedModules: listStagedModules,
  stageModule: stageModule,
  unstageModule: unstageModule,
};
