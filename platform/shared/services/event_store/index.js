'use strict';

var db = require('../db');

function _extractFromChannel(channel) {
  var parts = channel.split('.');
  var entityType = null;
  if (parts.length >= 2 && parts[0] !== '__reply' && parts[0] !== 'platform') {
    entityType = parts[0];
  }
  return entityType;
}

function _extractEntityId(payload) {
  if (!payload || typeof payload !== 'object') return null;

  if (payload.entityId !== undefined) return String(payload.entityId);
  if (payload.entity_id !== undefined) return String(payload.entity_id);
  if (payload.id !== undefined) return String(payload.id);

  var keys = Object.keys(payload);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k === '__replyChannel' || k === '__module' || k.indexOf('Text') !== -1) continue;
    if (/Id$/.test(k) || /_id$/.test(k)) {
      return String(payload[k]);
    }
  }
  return null;
}

function _formatRow(row) {
  return {
    id: row.id,
    channel: row.channel,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    publishedAt: row.published_at,
    entityType: row.entity_type,
    entityId: row.entity_id,
    module: row.module
  };
}

class EventStoreImpl {
  persist(channel, payload) {
    var publishedAt = Date.now();
    var payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});

    var entityType = null;
    var entityId = null;
    var moduleName = null;

    if (payload && typeof payload === 'object') {
      if (payload.entityType) entityType = payload.entityType;
      else if (payload.entity_type) entityType = payload.entity_type;
      moduleName = payload.__module || null;
    }

    if (!entityType) entityType = _extractFromChannel(channel);

    entityId = _extractEntityId(payload);

    var result = db.query(
      'INSERT INTO event_store (channel, payload, published_at, entity_type, entity_id, module) VALUES (?, ?, ?, ?, ?, ?)',
      [channel, payloadStr, publishedAt, entityType, entityId, moduleName]
    );

    return (result && result.lastInsertRowid) ? result.lastInsertRowid : null;
  }

  getById(id) {
    var result = db.query('SELECT * FROM event_store WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    return _formatRow(result.rows[0]);
  }

  getRecent(limit, offset) {
    limit = limit || 50;
    offset = offset || 0;
    var result = db.query(
      'SELECT * FROM event_store ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return result.rows.map(_formatRow);
  }

  getByChannel(channel, limit) {
    limit = limit || 50;
    var result = db.query(
      'SELECT * FROM event_store WHERE channel = ? ORDER BY id DESC LIMIT ?',
      [channel, limit]
    );
    return result.rows.map(_formatRow);
  }

  getByEntity(entityType, entityId, limit) {
    limit = limit || 50;
    var result = db.query(
      'SELECT * FROM event_store WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC LIMIT ?',
      [entityType, entityId, limit]
    );
    return result.rows.map(_formatRow);
  }

  getTimeline(from, to, limit) {
    limit = limit || 500;
    var result = db.query(
      'SELECT * FROM event_store WHERE published_at >= ? AND published_at <= ? ORDER BY published_at ASC LIMIT ?',
      [from, to, limit]
    );
    return result.rows.map(_formatRow);
  }

  getCount(channel) {
    var sql = 'SELECT COUNT(*) as total FROM event_store';
    var params = [];
    if (channel) {
      sql += ' WHERE channel = ?';
      params.push(channel);
    }
    var result = db.query(sql, params);
    return result.rows.length > 0 ? result.rows[0].total : 0;
  }
}

var eventStore = new EventStoreImpl();
module.exports = eventStore;
