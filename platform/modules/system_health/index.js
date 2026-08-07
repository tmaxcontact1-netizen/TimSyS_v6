'use strict';

const os = require('os');
const moduleRegistry = require('../../shared/registry/moduleRegistry');
const routeRegistry = require('../../shared/registry/routeRegistry');
const functionRegistry = require('../../shared/registry/functionRegistry');
const capabilityRegistry = require('../../shared/registry/capabilityRegistry');
const schemaRegistry = require('../../shared/registry/schemaRegistry');
const dependencyGraph = require('../../shared/registry/dependencyGraph');
const metrics = require('../../shared/services/metrics');
const gapAnalysis = require('../../engine/gap-analysis');
const recommendationEngine = require('../../engine/recommendation');

var startTime = Date.now();
var booted = false;

function boot(ctx) {
  ctx.log.info('system_health booting', { module: 'system_health' });
  booted = true;
  startTime = Date.now();
}

function teardown(ctx) {
  ctx.log.info('system_health tearing down', { module: 'system_health' });
  booted = false;
}

function getHealth(req, ctx) {
  return {
    success: true,
    status: 'alive',
    timestamp: Date.now(),
    uptime: (Date.now() - startTime) / 1000,
    nodeVersion: process.version,
  };
}

function getReady(req, ctx) {
  var moduleCount = moduleRegistry.count();
  var tableResult = ctx.db.query("SELECT name FROM sqlite_master WHERE type='table'");
  var tableCount = tableResult.rows.length;

  return {
    success: true,
    status: booted ? 'ready' : 'not_ready',
    modules: moduleCount,
    tables: tableCount,
    uptime: (Date.now() - startTime) / 1000,
  };
}

function getPlatform(req, ctx) {
  return {
    success: true,
    platform: {
      name: 'TimSyS',
      version: '6.1.0',
      nodeVersion: process.version,
      arch: process.arch,
      platform: process.platform,
      cpus: os.cpus().length,
      uptime: (Date.now() - startTime) / 1000,
      memoryUsage: process.memoryUsage(),
    },
  };
}

function getModules(req, ctx) {
  var modules = moduleRegistry.getAll().map(function(m) {
    return {
      name: m.name,
      version: m.version,
      status: m.status,
      booted: m.booted || false,
    };
  });

  return {
    success: true,
    modules: modules,
    total: modules.length,
  };
}

function getMetrics(req, ctx) {
  var prometheusFormat = metrics.exportPrometheus();
  return {
    success: true,
    metrics: prometheusFormat,
  };
}

function getRegistries(req, ctx) {
  return {
    success: true,
    registries: {
      modules: moduleRegistry.count(),
      routes: routeRegistry.getAll().length,
      functions: functionRegistry.getAll().length,
      capabilities: capabilityRegistry.getAll().length,
      schemas: schemaRegistry.getAll().length,
    },
  };
}

function getCapabilities(req, ctx) {
  var caps = capabilityRegistry.getAll().map(function(cap) {
    return {
      name: cap.name,
      module: cap.module,
      metadata: cap.metadata,
      registeredAt: cap.registeredAt,
    };
  });
  return {
    success: true,
    capabilities: caps,
    total: caps.length,
  };
}

function getFunctions(req, ctx) {
  var funcs = functionRegistry.getAll().map(function(fn) {
    return {
      name: fn.name,
      module: fn.module || 'unknown',
    };
  });
  return {
    success: true,
    functions: funcs,
    total: funcs.length,
  };
}

function getRoutes(req, ctx) {
  var routes = routeRegistry.getAll().map(function(r) {
    return {
      method: r.method,
      path: r.path,
      handler: r.handler,
      auth_required: r.auth_required,
    };
  });
  return {
    success: true,
    routes: routes,
    total: routes.length,
  };
}

function getDependencies(req, ctx) {
  var bootOrder = dependencyGraph.computeBootOrder();
  return {
    success: true,
    bootOrder: bootOrder,
    total: bootOrder.length,
  };
}


function getGaps(req, ctx) {
  var moduleName = req.query.module;
  var result = moduleName
    ? gapAnalysis.analyze(moduleName)
    : gapAnalysis.getPlatformCompletion();
  return {
    success: true,
    gaps: result
  };
}

function getTemplates(req, ctx) {
  var recs = recommendationEngine.getSuggestions(req.query.intent || null);
  return {
    success: true,
    templates: {
      suggestions: recs.suggestions,
      platformReadiness: recs.platformReadiness
    }
  };
}



function getAuditLogs(req, ctx) {
  var limit = parseInt(req.query.limit, 10) || 50;
  if (limit > 500) limit = 500;
  var offset = parseInt(req.query.offset, 10) || 0;
  var params = [];
  var sql = 'SELECT * FROM audit_log';
  var conditions = [];

  if (req.query.user_id) {
    conditions.push('user_id = ?');
    params.push(req.query.user_id);
  }
  if (req.query.action) {
    conditions.push('action LIKE ?');
    params.push('%' + req.query.action + '%');
  }
  if (req.query.entity_type) {
    conditions.push('entity_type = ?');
    params.push(req.query.entity_type);
  }
  if (req.query.entity_id) {
    conditions.push('entity_id = ?');
    params.push(req.query.entity_id);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = ctx.db.query(sql, params);
  var countResult = ctx.db.query('SELECT COUNT(*) as total FROM audit_log' + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''), conditions.length > 0 ? params.slice(0, conditions.length) : []);

  var logs = result.rows.map(function(row) {
    return {
      id: row.id,
      timestamp: row.timestamp,
      user_id: row.user_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      old_value: row.old_value ? (typeof row.old_value === 'string' ? JSON.parse(row.old_value) : row.old_value) : null,
      new_value: row.new_value ? (typeof row.new_value === 'string' ? JSON.parse(row.new_value) : row.new_value) : null,
      ip_address: row.ip_address
    };
  });

  return {
    success: true,
    logs: logs,
    total: parseInt(countResult.rows[0].total, 10),
    limit: limit,
    offset: offset
  };
}

function getAuditLog(req, ctx) {
  var result = ctx.db.query('SELECT * FROM audit_log WHERE id = ?', [req.params.id]);
  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Audit log entry not found' } };
  }
  var row = result.rows[0];
  return {
    success: true,
    log: {
      id: row.id,
      timestamp: row.timestamp,
      user_id: row.user_id,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      old_value: row.old_value ? (typeof row.old_value === 'string' ? JSON.parse(row.old_value) : row.old_value) : null,
      new_value: row.new_value ? (typeof row.new_value === 'string' ? JSON.parse(row.new_value) : row.new_value) : null,
      ip_address: row.ip_address
    }
  };
}

function discoverCapabilities(req, ctx) {
  var caps = capabilityRegistry.getAll().map(function(cap) {
    return {
      name: cap.name,
      module: cap.module,
      metadata: cap.metadata,
      registeredAt: cap.registeredAt
    };
  });
  var filter = req.query.module;
  if (filter) caps = caps.filter(function(c) { return c.module === filter; });
  return { success: true, capabilities: caps, total: caps.length };
}

function discoverFunctions(req, ctx) {
  var funcs = functionRegistry.getAll().map(function(fn) {
    return {
      name: fn.name,
      module: fn.module,
      metadata: fn.metadata,
      registeredAt: fn.registeredAt
    };
  });
  var filter = req.query.module;
  if (filter) funcs = funcs.filter(function(f) { return f.module === filter; });
  return { success: true, functions: funcs, total: funcs.length };
}

const staging = require('./handlers/staging');

module.exports = {
  boot: boot,
  teardown: teardown,
  getHealth: getHealth,
  getReady: getReady,
  getPlatform: getPlatform,
  getModules: getModules,
  getMetrics: getMetrics,
  getRegistries: getRegistries,
  getCapabilities: getCapabilities,
  getFunctions: getFunctions,
  getRoutes: getRoutes,
  getDependencies: getDependencies,
  getGaps: getGaps,
  getTemplates: getTemplates,
  getAuditLogs: getAuditLogs,
  getAuditLog: getAuditLog,
  discoverCapabilities: discoverCapabilities,
  discoverFunctions: discoverFunctions,
  listStagedModules: staging.listStagedModules,
  stageModule: staging.stageModule,
  unstageModule: staging.unstageModule
};