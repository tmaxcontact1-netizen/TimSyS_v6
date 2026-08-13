// File: platform/shared/services/statusActions.js
'use strict';
var crypto = require('crypto');

function actorId(req) {
  return req.user && req.user.id ? String(req.user.id) : 'system';
}

function validateWithdrawalReason(config, body, ctx) {
  var reasonCode = body.reasonCode || body.reason_code || 'profile_incomplete';
  var reason = ctx.db.query(
    "SELECT * FROM withdrawal_reasons WHERE code = ? AND enabled = 1 AND (applies_to = 'all' OR applies_to = ?)",
    [reasonCode, String(config.entityType).toLowerCase()]
  );
  if (!reason.rows.length) return { error: 'Select a valid withdrawal reason' };
  if (reason.rows[0].requires_detail && !body.note) return { error: 'Please add a short detail for this reason' };
  return { code: reasonCode };
}

/**
 * Shared status action utility for withdraw/reinstate/permanentDelete.
 * All builder-generated modules use these functions for consistent behaviour.
 *
 * @param {Object} config - Entity configuration
 * @param {string} config.table - Database table name
 * @param {string} config.altIdField - Alternative ID field for lookups (e.g. 'student_id')
 * @param {string} config.statusField - Status column name (e.g. 'enrollment_status')
 * @param {string} config.withdrawnValue - Value representing withdrawn status
 * @param {string} config.activeValue - Value representing active status
 * @param {string} config.entityType - Entity type for events/audit (e.g. 'student')
 * @param {string} config.moduleName - Module name for event namespacing
 */

function findRecord(config, id, ctx, req) {
  var sql = 'SELECT * FROM ' + config.table + ' WHERE (id = ?';
  var params = [id];
  if (config.altIdField) {
    sql += ' OR ' + config.altIdField + ' = ?';
    params.push(id);
  }
  sql += ')';
  if (config.scopeField) {
    sql += ' AND ' + config.scopeField + ' = ?';
    params.push(config.getScope(req));
  }
  var result = ctx.db.query(sql, params);
  if (!result.rows || result.rows.length === 0) return null;
  return result.rows[0];
}

function withdraw(config, req, ctx) {
  var id = req.params.id;
  var record = findRecord(config, id, ctx, req);
  if (!record) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: config.entityType + ' not found' } };
  }
  if (record[config.statusField] === config.withdrawnValue) {
    return { success: false, statusCode: 400, error: { code: 'ALREADY_WITHDRAWN', message: config.entityType + ' is already withdrawn' } };
  }
  var body = req.body || {};
  var reason = validateWithdrawalReason(config, body, ctx);
  if (reason.error) return { success: false, statusCode: 400, error: { code: 'INVALID_WITHDRAWAL_REASON', message: reason.error } };
  var effectiveAt = body.effectiveAt ? Date.parse(body.effectiveAt) : Date.now();
  if (!Number.isFinite(effectiveAt)) return { success: false, statusCode: 400, error: { code: 'INVALID_EFFECTIVE_DATE', message: 'Effective date is invalid' } };
  var withdrawalId = crypto.randomUUID();
  ctx.db.transaction(function(db) {
    db.query("UPDATE " + config.table + " SET " + config.statusField + " = ?, updated_at = datetime('now') WHERE id = ?", [config.withdrawnValue, record.id]);
    db.query(
      "INSERT INTO entity_withdrawals (id, entity_type, entity_id, reason_code, effective_at, note, destination, documentation_complete, actor_id, created_at, context_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [withdrawalId, String(config.entityType).toLowerCase(), String(record.id), reason.code, effectiveAt, body.note || null, body.destination || null, body.documentationComplete == null ? null : (body.documentationComplete ? 1 : 0), actorId(req), Date.now(), JSON.stringify(record)]
    );
  });
  if (ctx.audit) {
    ctx.audit.action(config.entityType + '.withdraw', req.user.id, { entityType: config.entityType, entityId: record.id, oldValue: record });
  }
  if (ctx.events) {
    ctx.events.publish(String(config.entityType).toLowerCase() + '.withdrawn', { eventId: crypto.randomUUID(), entityId: record.id, entityType: String(config.entityType).toLowerCase(), withdrawalId: withdrawalId, reasonCode: reason.code, effectiveAt: effectiveAt, actorId: actorId(req), __module: config.moduleName, schemaVersion: 1 });
  }
  return { success: true, message: config.entityType + ' withdrawn successfully' };
}

function reinstate(config, req, ctx) {
  var id = req.params.id;
  var record = findRecord(config, id, ctx, req);
  if (!record) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: config.entityType + ' not found' } };
  }
  if (record[config.statusField] !== config.withdrawnValue) {
    return { success: false, statusCode: 400, error: { code: 'NOT_WITHDRAWN', message: config.entityType + ' is not withdrawn' } };
  }
  var body = req.body || {};
  var now = body.effectiveAt ? Date.parse(body.effectiveAt) : Date.now();
  if (!Number.isFinite(now)) return { success: false, statusCode: 400, error: { code: 'INVALID_EFFECTIVE_DATE', message: 'Effective date is invalid' } };
  ctx.db.transaction(function(db) {
    db.query("UPDATE " + config.table + " SET " + config.statusField + " = ?, updated_at = datetime('now') WHERE id = ?", [config.activeValue, record.id]);
    db.query("UPDATE entity_withdrawals SET status = 'reinstated', reinstated_at = ?, reinstated_by = ?, reinstatement_reason = ? WHERE id = (SELECT id FROM entity_withdrawals WHERE entity_type = ? AND entity_id = ? AND status = 'withdrawn' ORDER BY effective_at DESC LIMIT 1)", [now, actorId(req), body.reason || null, String(config.entityType).toLowerCase(), String(record.id)]);
  });
  if (ctx.audit) {
    ctx.audit.action(config.entityType + '.reinstate', req.user.id, { entityType: config.entityType, entityId: record.id, oldValue: record });
  }
  if (ctx.events) {
    ctx.events.publish(String(config.entityType).toLowerCase() + '.reinstated', { eventId: crypto.randomUUID(), entityId: record.id, entityType: String(config.entityType).toLowerCase(), effectiveAt: now, reason: body.reason || null, actorId: actorId(req), __module: config.moduleName, schemaVersion: 1 });
  }
  return { success: true, message: config.entityType + ' reinstated successfully' };
}

function permanentDelete(config, req, ctx) {
  var id = req.params.id;
  var force = req.query && req.query.force === 'true';
  var record = findRecord(config, id, ctx, req);
  if (!record) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: config.entityType + ' not found' } };
  }
  var body = req.body || {};
  if (!body.reason && !force) return { success: false, statusCode: 400, error: { code: 'DELETE_REASON_REQUIRED', message: 'Give a short reason such as duplicate, test record, or entered in error' } };
  if (ctx.audit) {
    ctx.audit.action(config.entityType + '.permanent_delete', req.user.id, { entityType: config.entityType, entityId: record.id, oldValue: record });
  }
  ctx.db.query('DELETE FROM ' + config.table + ' WHERE id = ?', [record.id]);
  if (ctx.events) {
    ctx.events.publish(String(config.entityType).toLowerCase() + '.deleted_permanently', { eventId: crypto.randomUUID(), entityId: record.id, entityType: String(config.entityType).toLowerCase(), reason: body.reason || 'forced deletion', actorId: actorId(req), deletedRecord: record, __module: config.moduleName, schemaVersion: 1 });
  }
  return { success: true, message: config.entityType + ' permanently deleted' };
}

module.exports = {
  withdraw: withdraw,
  reinstate: reinstate,
  permanentDelete: permanentDelete
};
// Total lines: 97
