'use strict';
var crypto = require('crypto');
var db = require('../db');
function parse(value, fallback) { try { return JSON.parse(value); } catch (_) { return fallback; } }
function format(row) { return Object.assign({}, row, { content: parse(row.content, {}), scope: parse(row.scope, {}) }); }
module.exports = {
  put: function(item) {
    var id = item.id || crypto.randomUUID(); var now = Date.now();
    db.query('INSERT INTO knowledge_items (id, knowledge_type, name, version, content, source, owner, scope, authority_level, effective_from, effective_to, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, item.type, item.name, item.version || 1, JSON.stringify(item.content || {}), item.source || null, item.owner || null, JSON.stringify(item.scope || {}), item.authorityLevel || 'local', item.effectiveFrom || now, item.effectiveTo || null, item.enabled === false ? 0 : 1, now, now]); return id;
  },
  get: function(id) { var rows = db.query('SELECT * FROM knowledge_items WHERE id = ?', [id]).rows; return rows.length ? format(rows[0]) : null; },
  active: function(type, at) { at = at || Date.now(); var sql = 'SELECT * FROM knowledge_items WHERE enabled = 1 AND (effective_from IS NULL OR effective_from <= ?) AND (effective_to IS NULL OR effective_to > ?)'; var p = [at, at]; if (type) { sql += ' AND knowledge_type = ?'; p.push(type); } return db.query(sql, p).rows.map(format); }
};
