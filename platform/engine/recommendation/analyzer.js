'use strict';

const moduleRegistry = require('../../shared/registry/moduleRegistry');
const capabilityRegistry = require('../../shared/registry/capabilityRegistry');
const functionRegistry = require('../../shared/registry/functionRegistry');
const routeRegistry = require('../../shared/registry/routeRegistry');
const dependencyGraph = require('../../shared/registry/dependencyGraph');

/**
 * Recommendation Analyzer
 * Scans capabilities, detects orphans, clusters by functional area,
 * and suggests viable module builds.
 */

function clusterCapabilities() {
  var allCaps = capabilityRegistry.getAll();
  var clusters = {};

  for (var i = 0; i < allCaps.length; i++) {
    var cap = allCaps[i];
    var normalized = cap.name.indexOf('capability:') === 0 ? cap.name.slice('capability:'.length) : cap.name;
    var prefix = normalized.split('.')[0] || 'general';
    if (!clusters[prefix]) clusters[prefix] = [];
    clusters[prefix].push(cap.name);
  }

  return clusters;
}

function findOrphanCapabilities() {
  var allCaps = capabilityRegistry.getAll();
  var allRoutes = routeRegistry.getAll();
  var orphaned = [];

  for (var i = 0; i < allCaps.length; i++) {
    var cap = allCaps[i];
    var moduleRoutes = routeRegistry.getRoutesByModule(cap.module);
    if (moduleRoutes.length === 0) {
      orphaned.push(cap.name);
    }
  }

  return orphaned;
}

function findPartialModules() {
  var modules = moduleRegistry.getAll();
  var partial = [];

  for (var i = 0; i < modules.length; i++) {
    var mod = modules[i];
    var modRoutes = routeRegistry.getRoutesByModule(mod.name);
    var modFunctions = functionRegistry.listByModule(mod.name);
    var modCapabilities = capabilityRegistry.getByModule(mod.name);

    if (modCapabilities.length > 0 && modRoutes.length === 0) {
      partial.push({
        moduleName: mod.name,
        capabilities: modCapabilities.length,
        functions: modFunctions.length,
        routes: modRoutes.length,
        reason: 'capabilities_exist_no_routes'
      });
    } else if (modFunctions.length > modRoutes.length) {
      partial.push({
        moduleName: mod.name,
        capabilities: modCapabilities.length,
        functions: modFunctions.length,
        routes: modRoutes.length,
        reason: 'functions_exceed_routes'
      });
    }
  }

  return partial;
}

function findMissingModules(clusters) {
  var registeredModules = new Set(moduleRegistry.getAll().map(function(m) { return m.name; }));
  var missing = [];

  var clusterKeys = Object.keys(clusters);
  for (var i = 0; i < clusterKeys.length; i++) {
    var clusterName = clusterKeys[i];
    if (!registeredModules.has(clusterName)) {
      missing.push({
        suggestedModuleName: clusterName,
        capabilities: clusters[clusterName],
        capabilityCount: clusters[clusterName].length
      });
    }
  }

  return missing;
}

function analyze(intent) {
  var clusters = clusterCapabilities();
  var orphans = findOrphanCapabilities();
  var partials = findPartialModules();
  var missing = findMissingModules(clusters);

  var suggestions = [];

  // Suggest completing partial modules
  for (var i = 0; i < partials.length; i++) {
    var p = partials[i];
    var gapCount = p.functions - p.routes;
    suggestions.push({
      moduleName: p.moduleName,
      confidence: 0.7,
      completionPercent: 75,
      action: 'complete_partial',
      existingCapabilities: p.capabilities,
      missingArtifacts: gapCount,
      estimatedEffort: gapCount <= 2 ? '1 day' : gapCount <= 5 ? '2-3 days' : '1 week',
      recommendedNextSteps: [
        'Review module.json for unimplemented routes',
        'Wire missing routes to existing functions',
        'Test endpoints'
      ]
    });
  }

  // Suggest building missing modules
  for (var j = 0; j < missing.length; j++) {
    var m = missing[j];
    var relevance = intent ? 0.5 : 0.4;
    if (intent && m.suggestedModuleName.toLowerCase().indexOf(intent.toLowerCase()) !== -1) {
      relevance = 0.9;
    }
    suggestions.push({
      moduleName: m.suggestedModuleName,
      confidence: relevance,
      completionPercent: Math.max(25, Math.min(75, 100 - (m.capabilityCount * 10))),
      action: 'build_new',
      existingCapabilities: m.capabilities,
      missingArtifacts: m.capabilityCount,
      estimatedEffort: m.capabilityCount <= 2 ? '1-2 days' : m.capabilityCount <= 5 ? '3-5 days' : '1-2 weeks',
      recommendedNextSteps: [
        'Create module directory via scaffold CLI',
        'Write module.json declaring ' + m.capabilityCount + ' capabilities',
        'Implement handlers in index.js',
        'Wire routes to exposed functions'
      ]
    });
  }

  // Sort by confidence
  suggestions.sort(function(a, b) { return b.confidence - a.confidence; });

  var allModules = moduleRegistry.getAll();
  var allCaps = capabilityRegistry.getAll();

  return {
    suggestions: suggestions,
    platformReadiness: {
      availableCapabilities: allCaps.length,
      stagedModules: allModules.length,
      orphanCapabilities: orphans.length,
      partialModules: partials.length,
      missingModules: missing.length
    }
  };
}

module.exports = { analyze: analyze, clusterCapabilities: clusterCapabilities, findOrphanCapabilities: findOrphanCapabilities, findPartialModules: findPartialModules, findMissingModules: findMissingModules };
