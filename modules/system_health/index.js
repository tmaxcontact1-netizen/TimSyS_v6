'use strict';

const moduleJson = require('./module.json');
const log = require('../../shared/services/log');
const db = require('../../shared/services/db');
const cache = require('../../shared/services/cache');
const moduleRegistry = require('../../shared/registry/moduleRegistry');
const routeRegistry = require('../../shared/registry/routeRegistry');
const functionRegistry = require('../../shared/registry/functionRegistry');
const capabilityRegistry = require('../../shared/registry/capabilityRegistry');
const dependencyGraph = require('../../shared/registry/dependencyGraph');
const metrics = require('../../shared/services/metrics');

/**
 * System Health Module — Reference implementation for Phase 6.
 * Provides health checks, introspection endpoints, and metrics.
 */

async function boot(ctx) {
  log.info('system_health booting', { module: moduleJson.name });
  
  // Publish started event
  ctx.events.publish('platform.started', {
    moduleName: moduleJson.name,
    timestamp: Date.now(),
  });
}

function teardown(ctx) {
  log.info('system_health tearing down', { module: moduleJson.name });
}

/**
 * GET /health — Returns system alive status (no auth required)
 */
function system_health_getHealthCheck(req, ctx) {
  return {
    statusCode: 200,
    data: {
      success: true,
      status: 'alive',
      timestamp: Date.now(),
      uptime: process.uptime(),
      nodeVersion: process.version,
    },
  };
}

/**
 * GET /ready — Returns system ready to accept traffic
 */
function system_health_getReadyCheck(req, ctx) {
  const tablesOk = db.query(
    `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'`
  ).rows[0].count >= 10;

  const modulesBootCount = moduleRegistry.getAll().filter(m => m.status === 'booted').length;
  const totalModules = moduleRegistry.getAll().length;

  return {
    statusCode: 200,
    data: {
      success: tablesOk && totalModules > 0,
      status: tablesOk && totalModules > 0 ? 'ready' : 'not_ready',
      timestamp: Date.now(),
      databaseConnected: true,
      modulesLoaded: totalModules,
      modulesBooted: modulesBootCount,
      registriesPopulated: true,
    },
  };
}

/**
 * GET /introspect/platform — Full platform state summary
 */
function system_health_getPlatformInfo(req, ctx) {
  return {
    statusCode: 200,
    data: {
      totalModules: moduleRegistry.count(),
      totalCapabilities: capabilityRegistry.count(),
      totalFunctions: functionRegistry.count(),
      totalRoutes: routeRegistry.count(),
      dependencies: dependencyGraph.toJSON(),
      health: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now(),
      },
    },
  };
}

/**
 * GET /introspect/modules — List all staged modules
 */
function system_health_listModules(req, ctx) {
  return {
    statusCode: 200,
    data: {
      modules: moduleRegistry.getAll().map((m) => ({
        name: m.name,
        version: m.version,
        status: m.status,
        capabilitiesProvided: m.capabilitiesProvided,
        capabilitiesRequired: m.capabilitiesRequired,
        routes: m.routes.length,
        functions: m.functions.length,
        registeredAt: m.registeredAt,
      })),
      total: moduleRegistry.count(),
    },
  };
}

/**
 * GET /metrics — Prometheus-format metrics
 */
function system_health_getMetrics(req, ctx) {
  return {
    statusCode: 200,
    data: {
      prometheus: metrics.prometheusFormat(),
      snapshot: metrics.snapshot(),
    },
  };
}

// Event handler for platform.ready
function on_platform_ready(payload, ctx) {
  log.info('Received platform.ready event', { module: moduleJson.name, payload });
}

module.exports = {
  boot,
  teardown,
  system_health_getHealthCheck,
  system_health_getReadyCheck,
  system_health_getPlatformInfo,
  system_health_listModules,
  system_health_getMetrics,
  on_platform_ready,
};