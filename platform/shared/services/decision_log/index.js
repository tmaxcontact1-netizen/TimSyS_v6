'use strict';

var db = require('../db');

function _formatRow(row) {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    context: typeof row.context === 'string' ? JSON.parse(row.context) : row.context,
    rationale: row.rationale,
    outcome: row.outcome,
    relatedDecisionId: row.related_decision_id,
    createdAt: row.created_at
  };
}

class DecisionLogImpl {
  record(actorId, action, opts) {
    opts = opts || {};
    var contextStr = typeof opts.context === 'string' ? opts.context : JSON.stringify(opts.context || {});

    var result = db.query(
      'INSERT INTO decision_log (actor_id, actor_name, action, entity_type, entity_id, context, rationale, outcome, related_decision_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        actorId,
        opts.actorName || null,
        action,
        opts.entityType || null,
        opts.entityId != null ? String(opts.entityId) : null,
        contextStr,
        opts.rationale || null,
        opts.outcome || null,
        opts.relatedDecisionId || null
      ]
    );

    return (result && result.lastInsertRowid) ? result.lastInsertRowid : null;
  }

  getById(id) {
    var result = db.query('SELECT * FROM decision_log WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    return _formatRow(result.rows[0]);
  }

  getRecent(limit, offset) {
    limit = limit || 50;
    offset = offset || 0;
    var result = db.query(
      'SELECT * FROM decision_log ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return result.rows.map(_formatRow);
  }

  getByActor(actorId, limit) {
    limit = limit || 50;
    var result = db.query(
      'SELECT * FROM decision_log WHERE actor_id = ? ORDER BY id DESC LIMIT ?',
      [actorId, limit]
    );
    return result.rows.map(_formatRow);
  }

  getByEntity(entityType, entityId, limit) {
    limit = limit || 50;
    var result = db.query(
      'SELECT * FROM decision_log WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC LIMIT ?',
      [entityType, entityId, limit]
    );
    return result.rows.map(_formatRow);
  }

  getByAction(action, limit) {
    limit = limit || 50;
    var result = db.query(
      'SELECT * FROM decision_log WHERE action = ? ORDER BY id DESC LIMIT ?',
      [action, limit]
    );
    return result.rows.map(_formatRow);
  }

  updateOutcome(id, outcome) {
    var result = db.query(
      'UPDATE decision_log SET outcome = ? WHERE id = ?',
      [outcome, id]
    );
    return (result && result.changes > 0);
  }

  getCount(action) {
    var sql = 'SELECT COUNT(*) as total FROM decision_log';
    var params = [];
    if (action) {
      sql += ' WHERE action = ?';
      params.push(action);
    }
    var result = db.query(sql, params);
    return result.rows.length > 0 ? result.rows[0].total : 0;
  }
}

var decisionLog = new DecisionLogImpl();
module.exports = decisionLog;
