'use strict';

const fs = require('fs');

function certify(component, manifest, options) {
  const errors = [];
  const parts = component.parts || [];
  const contractPath = options && options.contractPath;
  if (!component.name || !/^[a-z][a-z0-9_]*$/.test(component.name)) errors.push('name must be a lowercase identifier');
  if (!component.type) errors.push('type is required');
  if (!manifest || !/^\d+\.\d+\.\d+$/.test(manifest.version || '')) errors.push('owner module must provide a semantic version');
  if (!contractPath || !fs.existsSync(contractPath)) errors.push('CONTRACT.md is required');
  if (!Array.isArray(component.capabilities) || !component.capabilities.length) errors.push('at least one capability is required');
  if (!Array.isArray(component.dependencies)) errors.push('dependencies must be an array');
  if (!Array.isArray(parts)) errors.push('parts must be an array');
  else {
    const names = parts.map(function(part) { return typeof part === 'string' ? part : part && part.name; });
    if (names.some(function(name) { return !name || !/^[a-z][a-z0-9_]*$/.test(name); })) errors.push('parts must be descriptive lowercase identifiers');
    if (new Set(names).size !== names.length) errors.push('parts must be unique');
    if (parts.some(function(part) { return part && typeof part === 'object' && (part.insights || part.health || part.telemetry); })) errors.push('parts cannot declare insights, health or telemetry');
  }
  if (!component.insights || !component.insights.platform || component.insights.platform.heartbeat !== true || component.insights.platform.health !== true) errors.push('component health and heartbeat policy is required');
  if (!component.insights || !component.insights.operational || component.insights.operational.enabled !== true) errors.push('operational insight policy is required');
  if (component.type !== 'composite_module' && (!component.intelligence || !Array.isArray(component.intelligence.entities) || !component.intelligence.entities.length)) errors.push('at least one intelligence entity is required');
  if (!manifest || !Array.isArray(manifest.routes) || !Array.isArray(manifest.functions)) errors.push('owner module route and function contracts are required');
  const capabilities = new Set((manifest && manifest.provides) || []);
  (component.capabilities || []).forEach(function(capability) { if (!capabilities.has(capability)) errors.push('capability is not provided by owner module: ' + capability); });
  return {
    status: errors.length ? 'failed' : 'certified',
    version: component.version || (manifest && manifest.version) || null,
    standard: 1,
    checkedAt: Date.now(),
    errors: errors
  };
}

module.exports = { certify: certify };
