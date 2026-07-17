'use strict';

const db = require('./db');

const RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS, 10) || 365;
const CLEANUP_INTERVAL = 86400000; // 24h

let cleanupTimer = null;

/**
 * Immutable append-only audit log writer.
 * Used by log.js — not injected into module Context.
 */
class AuditWriter {
  constructor() {
    if (!cleanupTimer) {
      cleanupTimer = setInterval(() => this._purgeOld(), CLEANUP_INTERVAL);
      cleanupTimer.unref();
    }
  }

  write(action, userId, meta = {}) {
    db.query(
      `INSERT INTO audit_log (timestamp, user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Date.now(),
        userId,
        action,
        meta.entityType || null,
        meta.entityId || null,
        meta.oldValue ? JSON.stringify(meta.oldValue) : null,
        meta.newValue ? JSON.stringify(meta.newValue) : null,
        meta.ipAddress || null,
      ]
    );
  }

  query(filters = {}) {
    let sql = `SELECT * FROM audit_log WHERE 1=1`;
    const params = [];

    if (filters.userId) {
      sql += ` AND user_id = ?`;
      params.push(filters.userId);
    }
    if (filters.action) {
      sql += ` AND action = ?`;
      params.push(filters.action);
    }
    if (filters.entityType) {
      sql += ` AND entity_type = ?`;
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      sql += ` AND entity_id = ?`;
      params.push(filters.entityId);
    }
    if (filters.from) {
      sql += ` AND timestamp >= ?`;
      params.push(filters.from);
    }
    if (filters.to) {
      sql += ` AND timestamp <= ?`;
      params.push(filters.to);
    }

    sql += ` ORDER BY timestamp DESC`;

    if (filters.limit) {
      sql += ` LIMIT ?`;
      params.push(filters.limit);
    }

    const result = db.query(sql, params);
    return result.rows;
  }

  getById(id) {
    const result = db.query(`SELECT * FROM audit_log WHERE id = ?`, [id]);
    return result.rows[0] || null;
  }

  _purgeOld() {
    const cutoff = Date.now() - RETENTION_DAYS * 86400000;
    db.query(`DELETE FROM audit_log WHERE timestamp < ?`, [cutoff]);
  }
}

const auditWriter = new AuditWriter();

module.exports = auditWriter;