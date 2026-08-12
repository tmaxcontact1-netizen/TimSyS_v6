'use strict';
var crypto = require('crypto');
var db = require('../db');
module.exports = {
  capture: function(entityType, entityId, snapshotType, state, evidenceEventId, at) {
    var id = crypto.randomUUID(); db.query('INSERT INTO entity_snapshots (id, entity_type, entity_id, snapshot_type, state, evidence_event_id, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, entityType, String(entityId), snapshotType, JSON.stringify(state || {}), evidenceEventId || null, at || Date.now()]); return id;
  },
  latest: function(entityType, entityId, snapshotType, at) { var rows = db.query('SELECT * FROM entity_snapshots WHERE entity_type=? AND entity_id=? AND snapshot_type=? AND captured_at<=? ORDER BY captured_at DESC LIMIT 1', [entityType, String(entityId), snapshotType, at || Date.now()]).rows; if (!rows.length) return null; rows[0].state = JSON.parse(rows[0].state); return rows[0]; },
  timeline: function(entityType, entityId, snapshotType, from, to) { return db.query('SELECT * FROM entity_snapshots WHERE entity_type=? AND entity_id=? AND snapshot_type=? AND captured_at BETWEEN ? AND ? ORDER BY captured_at', [entityType, String(entityId), snapshotType, from || 0, to || Date.now()]).rows.map(function(row) { row.state=JSON.parse(row.state); return row; }); }
};
