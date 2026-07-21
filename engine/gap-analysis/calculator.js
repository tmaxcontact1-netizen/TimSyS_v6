'use strict';

const moduleRegistry = require('../../shared/registry/moduleRegistry');
const capabilityRegistry = require('../../shared/registry/capabilityRegistry');
const functionRegistry = require('../../shared/registry/functionRegistry');
const routeRegistry = require('../../shared/registry/routeRegistry');
const schemaRegistry = require('../../shared/registry/schemaRegistry');
const dependencyGraph = require('../../shared/registry/dependencyGraph');

/**
 * Gap Analysis Calculator
 * Compares declared vs actual module artifacts.
 * Metrics weighted: capabilities 40%, functions 30%, routes 20%, schema 10%.
 */

function calculate(moduleName) {
  var mod = moduleRegistry.get(moduleName);
  if (!mod) {
    return { moduleName: moduleName, completionScore: 0, status: 'red', gaps: [], recommendedActions: [] };
  }

  var manifest = mod;
  var declaredCapabilities = manifest.capabilitiesProvided || [];
  var declaredFunctions = manifest.functions || [];
  var declaredRoutes = manifest.routes || [];
  var declaredSchema = manifest.schema || {};

  // Actual registered artifacts
  var actualCapabilities = capabilityRegistry.getByModule(moduleName);
  var actualFunctions = functionRegistry.listByModule(moduleName);
  var actualRoutes = routeRegistry.getRoutesByModule(moduleName).map(function(r) { return r.path + ':' + r.method; });
  var actualTables = schemaRegistry.getTablesByOwner(moduleName);

  // Calculate coverage
  var capCoverage = declaredCapabilities.length > 0
    ? actualCapabilities.filter(function(c) { return declaredCapabilities.indexOf(c) !== -1; }).length / declaredCapabilities.length
    : 1;
  var funcCoverage = declaredFunctions.length > 0
    ? actualFunctions.length / declaredFunctions.length
    : 1;
  var routeCoverage = declaredRoutes.length > 0
    ? actualRoutes.length / declaredRoutes.length
    : 1;
  var schemaCoverage = (declaredSchema.tables && declaredSchema.tables.length > 0)
    ? actualTables.filter(function(t) { return declaredSchema.tables.indexOf(t) !== -1; }).length / declaredSchema.tables.length
    : 1;

  // Weighted score
  var score = Math.round((capCoverage * 0.4 + funcCoverage * 0.3 + routeCoverage * 0.2 + schemaCoverage * 0.1) * 100);

  // Determine status
  var status = score < 25 ? 'red' : score < 50 ? 'yellow' : 'green';

  // Identify gaps
  var gaps = [];

  var missingCaps = declaredCapabilities.filter(function(c) { return actualCapabilities.indexOf(c) === -1; });
  if (missingCaps.length > 0) gaps.push({ category: 'capability', missing: missingCaps, priority: 'high' });

  var missingFuncs = declaredFunctions
    .filter(function(f) { return actualFunctions.indexOf(f.name) === -1; })
    .map(function(f) { return f.name; });
  if (missingFuncs.length > 0) gaps.push({ category: 'function', missing: missingFuncs, priority: 'high' });

  var missingRoutes = declaredRoutes
    .filter(function(r) { return actualRoutes.indexOf(r.path + ':' + r.method) === -1; })
    .map(function(r) { return r.method + ' ' + r.path; });
  if (missingRoutes.length > 0) gaps.push({ category: 'route', missing: missingRoutes, priority: 'medium' });

  var missingMigrations = (declaredSchema.migrations || []).filter(function(m) {
    return actualTables.length === 0;
  });
  if (missingMigrations.length > 0) gaps.push({ category: 'migration', missing: missingMigrations, priority: 'low' });

  // Check dependency availability
  var missingDeps = dependencyGraph.getMissingDependencies(moduleName);
  if (missingDeps.length > 0) gaps.push({ category: 'dependency', missing: missingDeps, priority: 'blocking' });

  // Recommended actions
  var actions = [];
  for (var i = 0; i < gaps.length; i++) {
    var gap = gaps[i];
    if (gap.category === 'function') {
      for (var j = 0; j < gap.missing.length; j++) {
        actions.push('Implement ' + gap.missing[j] + ' in index.js');
      }
    } else if (gap.category === 'route') {
      for (var k = 0; k < gap.missing.length; k++) {
        actions.push('Wire route ' + gap.missing[k] + ' to handler function');
      }
    } else if (gap.category === 'migration') {
      actions.push('Apply pending migrations for ' + moduleName);
    } else if (gap.category === 'dependency') {
      actions.push('Resolve missing dependencies: ' + gap.missing.join(', '));
    }
  }

  return {
    moduleName: moduleName,
    completionScore: score,
    status: status,
    metrics: {
      capabilityCoverage: Math.round(capCoverage * 100),
      functionCompleteness: Math.round(funcCoverage * 100),
      routeCompleteness: Math.round(routeCoverage * 100),
      schemaCompleteness: Math.round(schemaCoverage * 100)
    },
    gaps: gaps,
    recommendedActions: actions
  };
}

function analyzeAll() {
  var modules = moduleRegistry.getAll();
  return modules.map(function(m) { return calculate(m.name); });
}

module.exports = { calculate: calculate, analyzeAll: analyzeAll };
