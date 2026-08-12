'use strict';

var EVENT_KINDS = ['created', 'updated', 'withdrawn', 'reinstated', 'deleted'];
function identifier(value) { return typeof value === 'string' && /^[a-z][a-z0-9_]*$/.test(value); }

function validate(contract, componentName) {
  var errors = [];
  if (!contract || typeof contract !== 'object') return { valid: false, errors: ['intelligence must be an object'] };
  if (contract.version !== 1) errors.push('intelligence.version must be 1');
  if (!Array.isArray(contract.entities) || !contract.entities.length) errors.push('intelligence.entities must contain at least one entity declaration');
  (contract.entities || []).forEach(function(entity, i) {
    var at = 'intelligence.entities[' + i + ']';
    if (!identifier(entity.type)) errors.push(at + '.type must be a lowercase identifier');
    if (!entity.source || !identifier(entity.source.table) || !identifier(entity.source.idField)) errors.push(at + '.source requires table and idField identifiers');
    if (!Array.isArray(entity.displayFields)) errors.push(at + '.displayFields must be an array');
    var eventDriven = Array.isArray(entity.events) && entity.events.length > 0;
    if (eventDriven && !identifier(entity.statusField)) errors.push(at + '.statusField is required for event-driven entities');
    var channels = new Set();
    (entity.events || []).forEach(function(event, e) {
      if (!event.channel || typeof event.channel !== 'string') errors.push(at + '.events[' + e + '].channel is required');
      if (EVENT_KINDS.indexOf(event.kind) < 0) errors.push(at + '.events[' + e + '].kind is invalid');
      if (channels.has(event.channel)) errors.push(at + '.events contains duplicate channel ' + event.channel);
      channels.add(event.channel);
    });
    (entity.relationships || []).forEach(function(rel, r) {
      if (!identifier(rel.field) || !identifier(rel.type) || !identifier(rel.targetType)) errors.push(at + '.relationships[' + r + '] requires field, type and targetType');
    });
    (entity.dataQuality || []).forEach(function(rule, q) {
      if (!identifier(rule.field) || !rule.expectation) errors.push(at + '.dataQuality[' + q + '] requires field and expectation');
    });
  });
  return { valid: errors.length === 0, errors: errors, component: componentName };
}

function assertValid(contract, componentName) {
  var result = validate(contract, componentName);
  if (!result.valid) throw new Error('Invalid intelligence contract for component "' + componentName + '":\n  - ' + result.errors.join('\n  - '));
  return contract;
}
function assertSchema(contract, componentName, db) {
  (contract.entities || []).forEach(function(entity, i) {
    var columns = db.query('PRAGMA table_info("' + entity.source.table + '")').rows.map(function(row) { return row.name; });
    if (!columns.length) throw new Error('Intelligence contract for "' + componentName + '" references missing table ' + entity.source.table);
    var fields = [entity.source.idField, entity.statusField].concat(entity.displayFields || []);
    (entity.relationships || []).forEach(function(rel) { fields.push(rel.field); });
    (entity.dataQuality || []).forEach(function(rule) { fields.push(rule.field); });
    fields.filter(Boolean).forEach(function(field) {
      if (columns.indexOf(field) === -1) throw new Error('Intelligence contract for "' + componentName + '" references missing column ' + entity.source.table + '.' + field + ' at entity ' + i);
    });
  });
  return contract;
}
module.exports = { validate: validate, assertValid: assertValid, assertSchema: assertSchema, eventKinds: EVENT_KINDS };
