// File: platform/shared/services/statusActions.js
'use strict';

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

function findRecord(config, id, ctx) {
  var sql = 'SELECT * FROM ' + config.table + ' WHERE id = ?';
  var params = [id];
  if (config.altIdField) {
    sql += ' OR ' + config.altIdField + ' = ?';
    params.push(id);
  }
  var result = ctx.db.query(sql, params);
  if (!result.rows || result.rows.length === 0) return null;
  return result.rows[0];
}

function withdraw(config, req, ctx) {
  var id = req.params.id;
  var record = findRecord(config, id, ctx);
  if (!record) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: config.entityType + ' not found' } };
  }
  if (record[config.statusField] === config.withdrawnValue) {
    return { success: false, statusCode: 400, error: { code: 'ALREADY_WITHDRAWN', message: config.entityType + ' is already withdrawn' } };
  }
  ctx.db.query(
    "UPDATE " + config.table + " SET " + config.statusField + " = ?, updated_at = datetime('now') WHERE id = ?",
    [config.withdrawnValue, record.id]
  );
  if (ctx.audit) {
    ctx.audit.action(config.entityType + '.withdraw', req.user.id, { entityType: config.entityType, entityId: record.id, oldValue: record });
  }
  if (ctx.events) {
    ctx.events.publish(config.entityType + '.withdrawn', { entityId: record.id, entityType: config.entityType, __module: config.moduleName });
  }
  return { success: true, message: config.entityType + ' withdrawn successfully' };
}

function reinstate(config, req, ctx) {
  var id = req.params.id;
  var record = findRecord(config, id, ctx);
  if (!record) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: config.entityType + ' not found' } };
  }
  if (record[config.statusField] !== config.withdrawnValue) {
    return { success: false, statusCode: 400, error: { code: 'NOT_WITHDRAWN', message: config.entityType + ' is not withdrawn' } };
  }
  ctx.db.query(
    "UPDATE " + config.table + " SET " + config.statusField + " = ?, updated_at = datetime('now') WHERE id = ?",
    [config.activeValue, record.id]
  );
  if (ctx.audit) {
    ctx.audit.action(config.entityType + '.reinstate', req.user.id, { entityType: config.entityType, entityId: record.id, oldValue: record });
  }
  if (ctx.events) {
    ctx.events.publish(config.entityType + '.reinstated', { entityId: record.id, entityType: config.entityType, __module: config.moduleName });
  }
  return { success: true, message: config.entityType + ' reinstated successfully' };
}

function permanentDelete(config, req, ctx) {
  var id = req.params.id;
  var force = req.query && req.query.force === 'true';
  var record = findRecord(config, id, ctx);
  if (!record) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: config.entityType + ' not found' } };
  }
  if (record[config.statusField] !== config.withdrawnValue && !force) {
    return { success: false, statusCode: 400, error: { code: 'NOT_WITHDRAWN', message: config.entityType + ' must be withdrawn before permanent deletion. Use ?force=true to bypass.' } };
  }
  if (ctx.audit) {
    ctx.audit.action(config.entityType + '.permanent_delete', req.user.id, { entityType: config.entityType, entityId: record.id, oldValue: record });
  }
  ctx.db.query('DELETE FROM ' + config.table + ' WHERE id = ?', [record.id]);
  if (ctx.events) {
    ctx.events.publish(config.entityType + '.deleted_permanently', { entityId: record.id, entityType: config.entityType, __module: config.moduleName });
  }
  return { success: true, message: config.entityType + ' permanently deleted' };
}

module.exports = {
  withdraw: withdraw,
  reinstate: reinstate,
  permanentDelete: permanentDelete
};
// Total lines: 97