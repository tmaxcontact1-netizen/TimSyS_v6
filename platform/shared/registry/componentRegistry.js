'use strict';

const db = require('../services/db');
const log = require('../services/log');

var components = new Map();

/**
 * Register a component.
 * @param {Object} component - Component definition
 * @param {string} component.name - Unique identifier
 * @param {string} component.type - Category (registry, allocation, inventory, etc.)
 * @param {string|null} component.ownerModule - Module that owns this component
 * @param {string[]} component.dependencies - Required dependencies
 * @param {Object|null} component.routes - Route declarations
 * @param {Object|null} component.schema - Schema with tables/migrations
 * @param {Object|null} component.capabilities - Capabilities provided
 * @param {Object|null} component.events - Event subscriptions/publications
 */
function register(component) {
  if (!component.name) throw new Error('ComponentRegistry: component.name is required');
  
  var existing = components.get(component.name);
  if (existing) {
    log.warn('Component "' + component.name + '" already registered, overwriting', { component: component.name });
  }
  
  var record = {
    name: component.name,
    type: component.type || 'generic',
    ownerModule: component.ownerModule || null,
    dependencies: component.dependencies || [],
    routes: component.routes || null,
    schema: component.schema || null,
    capabilities: component.capabilities || null,
    events: component.events || null,
    intelligence: component.intelligence || null,
    insights: component.insights || null,
    parts: component.parts || []
    ,version: component.version || null
    ,certification: component.certification || { status: 'uncertified', errors: ['No certification result'] }
  };
  
  components.set(component.name, record);
  
  db.query(
    'INSERT OR REPLACE INTO component_registry (name, type, owner_module, dependencies, routes, schema, capabilities, events, intelligence_contract, insight_policy, parts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      record.name,
      record.type,
      record.ownerModule,
      JSON.stringify(record.dependencies),
      JSON.stringify(record.routes),
      JSON.stringify(record.schema),
      JSON.stringify(record.capabilities),
      JSON.stringify(record.events),
      JSON.stringify(record.intelligence),
      JSON.stringify(record.insights),
      JSON.stringify(record.parts)
    ]
  );
  
  log.info('Registered component "' + component.name + '"', { 
    component: component.name, 
    type: record.type,
    owner: record.ownerModule
  });
}

function get(name) {
  return components.get(name) || null;
}

function exists(name) {
  return components.has(name);
}

function getAll() {
  return Array.from(components.values());
}

function getByModule(moduleName) {
  return Array.from(components.values()).filter(function(c) { return c.ownerModule === moduleName; });
}

function getByType(type) {
  return Array.from(components.values()).filter(function(c) { return c.type === type; });
}

function getMissing(requiredComponents) {
  if (!requiredComponents || !Array.isArray(requiredComponents)) return [];
  return requiredComponents.filter(function(name) { return !components.has(name); });
}

function loadAll() {
  var result = db.query('SELECT * FROM component_registry');
  if (!result.rows || result.rows.length === 0) return;
  
  result.rows.forEach(function(row) {
    components.set(row.name, {
      name: row.name,
      type: row.type,
      ownerModule: row.owner_module,
      dependencies: JSON.parse(row.dependencies || '[]'),
      routes: row.routes ? JSON.parse(row.routes) : null,
      schema: row.schema ? JSON.parse(row.schema) : null,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : null,
      events: row.events ? JSON.parse(row.events) : null,
      intelligence: row.intelligence_contract ? JSON.parse(row.intelligence_contract) : null,
      insights: row.insight_policy ? JSON.parse(row.insight_policy) : null,
      parts: row.parts ? JSON.parse(row.parts) : []
      ,version: null
      ,certification: { status: 'uncertified', errors: ['Re-scan required'] }
    });
  });
  
  log.info('Loaded component registry from DB', { count: components.size });
}

function clear() {
  components.clear();
  db.query('DELETE FROM component_registry');
}

module.exports = {
  register: register,
  get: get,
  exists: exists,
  getAll: getAll,
  getByModule: getByModule,
  getByType: getByType,
  getMissing: getMissing,
  loadAll: loadAll,
  clear: clear
};
