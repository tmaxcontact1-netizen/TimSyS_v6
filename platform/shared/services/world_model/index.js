'use strict';
var db = require('../db');
var crypto = require('crypto');
var componentRegistry = require('../../registry/componentRegistry');
function contribution(channel, moduleName) {
  var components = componentRegistry.getByModule(moduleName || '');
  for (var c = 0; c < components.length; c++) {
    var entities = components[c].intelligence && components[c].intelligence.entities || [];
    for (var e = 0; e < entities.length; e++) {
      var declared = (entities[e].events || []).some(function(event) { return event.channel === channel; });
      if (declared) return entities[e];
    }
  }
  return null;
}
function label(facts, declaration, type, id) {
  var values = (declaration.displayFields || []).map(function(field) { return facts[field]; }).filter(Boolean);
  return values.join(' ') || type + ' ' + id;
}
function quality(facts, rules) {
  if (!rules || !rules.length) return 1;
  var passed = rules.filter(function(rule) {
    var value = facts[rule.field];
    if (rule.expectation === 'required') return value !== null && value !== undefined && value !== '';
    if (rule.expectation === 'positive_number') return Number(value) > 0;
    if (rule.expectation === 'non_negative_number') return Number(value) >= 0;
    return false;
  }).length;
  var declaredQuality = passed / rules.length;
  try {
    var custom = typeof facts.custom_fields === 'string' ? JSON.parse(facts.custom_fields) : facts.custom_fields;
    var warnings = custom && custom.csv_import && custom.csv_import.warnings;
    if (Array.isArray(warnings) && warnings.length) return Math.min(declaredQuality, Math.max(0, 1 - warnings.length / Math.max(rules.length, warnings.length + 1)));
  } catch (_) {}
  return declaredQuality;
}
function syncRelationships(declaration, type, id, facts, moduleName, now) {
  (declaration.relationships || []).forEach(function(rel) {
    if (rel.when && facts[rel.when.field] !== rel.when.value) return;
    var target = facts[rel.field];
    db.query('UPDATE world_relationships SET valid_to = ? WHERE subject_type = ? AND subject_id = ? AND relationship_type = ? AND object_type = ? AND valid_to IS NULL AND object_id <> ?', [now, type, id, rel.type, rel.targetType, target == null ? '' : String(target)]);
    if (target == null || target === '') return;
    var existing = db.query('SELECT id FROM world_relationships WHERE subject_type = ? AND subject_id = ? AND relationship_type = ? AND object_type = ? AND object_id = ? AND valid_to IS NULL', [type, id, rel.type, rel.targetType, String(target)]);
    if (!existing.rows.length) {
      var relationshipId = crypto.createHash('sha256').update([type,id,rel.type,rel.targetType,target,now].join('|')).digest('hex');
      db.query('INSERT INTO world_relationships (id, subject_type, subject_id, relationship_type, object_type, object_id, valid_from, provenance, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [relationshipId, type, id, rel.type, rel.targetType, String(target), now, JSON.stringify({ module: moduleName, field: rel.field }), 1, now]);
    }
  });
}
module.exports = {
  projectBackfill: function(declaration,moduleName,facts,boundary) {
    var id=String(facts[declaration.source.idField]);var type=declaration.type;var status=facts[declaration.statusField]||'active';var dataQuality=quality(facts,declaration.dataQuality);
    db.query("INSERT INTO world_entities (entity_type,entity_id,owning_module,display_name,lifecycle_status,facts,data_quality,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(entity_type,entity_id) DO UPDATE SET owning_module=excluded.owning_module,display_name=excluded.display_name,lifecycle_status=excluded.lifecycle_status,facts=excluded.facts,data_quality=excluded.data_quality,last_seen_at=excluded.last_seen_at",[type,id,moduleName,label(facts,declaration,type,id),status,JSON.stringify(facts),dataQuality,boundary,boundary]);syncRelationships(declaration,type,id,facts,moduleName,boundary);return true;
  },
  project: function(channel, payload) {
    payload = payload || {}; if (!payload.__module || payload.entityId == null) return false;
    var declaration = contribution(channel, payload.__module); if (!declaration) return false;
    var type = declaration.type; var id = String(payload.entityId); var now = Date.now();
    if (payload.entityType && String(payload.entityType).toLowerCase() !== type) throw new Error('Event ' + channel + ' declared entity type ' + type + ' but published ' + payload.entityType);
    if (channel.endsWith('.deleted_permanently')) { db.query('DELETE FROM world_entities WHERE entity_type = ? AND entity_id = ?', [type, id]); return true; }
    var existing = db.query('SELECT facts FROM world_entities WHERE entity_type = ? AND entity_id = ?', [type, id]).rows;
    var facts = payload.record || payload.facts || (existing.length ? JSON.parse(existing[0].facts) : {});
    var status = channel.endsWith('.withdrawn') ? 'withdrawn' : channel.endsWith('.reinstated') ? 'active' : (facts[declaration.statusField] || 'active');
    var dataQuality = quality(facts, declaration.dataQuality);
    db.query("INSERT INTO world_entities (entity_type, entity_id, owning_module, display_name, lifecycle_status, facts, data_quality, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(entity_type, entity_id) DO UPDATE SET owning_module=excluded.owning_module, display_name=excluded.display_name, lifecycle_status=excluded.lifecycle_status, facts=excluded.facts, data_quality=excluded.data_quality, last_seen_at=excluded.last_seen_at", [type, id, payload.__module, label(facts, declaration, type, id), status, JSON.stringify(facts), dataQuality, now, now]);
    syncRelationships(declaration, type, id, facts, payload.__module, now);
    return true;
  },
  get: function(type, id) { var rows = db.query('SELECT * FROM world_entities WHERE entity_type = ? AND entity_id = ?', [type, String(id)]).rows; if (!rows.length) return null; rows[0].facts = JSON.parse(rows[0].facts); return rows[0]; }
};
