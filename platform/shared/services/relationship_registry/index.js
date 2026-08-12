'use strict';
var crypto = require('crypto');
var db = require('../db');

function parse(value, fallback) { try { return JSON.parse(value); } catch (_) { return fallback; } }
function format(row) { return Object.assign({}, row, { provenance: parse(row.provenance, {}) }); }

module.exports = {
  connect: function(subject, type, object, options) {
    options = options || {};
    var id = options.id || crypto.randomUUID();
    db.query('INSERT INTO world_relationships (id, subject_type, subject_id, relationship_type, object_type, object_id, valid_from, valid_to, provenance, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, subject.type, String(subject.id), type, object.type, String(object.id), options.validFrom || Date.now(), options.validTo || null, JSON.stringify(options.provenance || {}), options.confidence == null ? 1 : options.confidence, Date.now()]);
    return id;
  },
  forEntity: function(type, id, at) {
    at = at || Date.now();
    return db.query("SELECT * FROM world_relationships WHERE ((subject_type = ? AND subject_id = ?) OR (object_type = ? AND object_id = ?)) AND (valid_from IS NULL OR valid_from <= ?) AND (valid_to IS NULL OR valid_to > ?) ORDER BY created_at", [type, String(id), type, String(id), at, at]).rows.map(format);
  },
  end: function(id, at) { return db.query('UPDATE world_relationships SET valid_to = ? WHERE id = ? AND valid_to IS NULL', [at || Date.now(), id]).changes > 0; }
};
