'use strict';

const os = require('os');
const moduleRegistry = require('../../shared/registry/moduleRegistry');
const routeRegistry = require('../../shared/registry/routeRegistry');
const functionRegistry = require('../../shared/registry/functionRegistry');
const capabilityRegistry = require('../../shared/registry/capabilityRegistry');
const schemaRegistry = require('../../shared/registry/schemaRegistry');
const dependencyGraph = require('../../shared/registry/dependencyGraph');
const metrics = require('../../shared/services/metrics');

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

module.exports = {
  boot: boot,
  teardown: teardown,
  getHealth: getHealth,
  getReady: getReady,
  getPlatform: getPlatform,
  getModules: getModules,
  getMetrics: getMetrics,
  getRegistries: getRegistries,
};