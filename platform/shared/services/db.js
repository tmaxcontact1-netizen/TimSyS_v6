'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

var conn = null;
var PLATFORM_ROOT = path.resolve(__dirname, '../..');

function databasePath() {
  var configured = process.env.DB_PATH;
  if (!configured) return path.join(PLATFORM_ROOT, 'data', 'timsys.sqlite');
  return path.isAbsolute(configured) ? configured : path.resolve(PLATFORM_ROOT, configured);
}

function init() {
  if (conn) return conn;

  var DB_PATH = databasePath();
  var DB_DIR = path.dirname(DB_PATH);

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
  } catch (err) {
    // Ignore if dir exists
  }

  conn = new Database(DB_PATH);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  conn.pragma('busy_timeout = 5000');

  return conn;
}

function DBServiceImpl() {}

DBServiceImpl.prototype.query = function(sql, params) {
  var c = init();
  var bound = params || [];
  var stmt = c.prepare(sql);
  if (stmt.reader) {
    return { rows: stmt.all(bound), changes: 0 };
  } else {
    var result = stmt.run(bound);
    return { rows: [], changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }
};

DBServiceImpl.prototype.exec = function(sql) {
  var c = init();
  c.exec(sql);
};

DBServiceImpl.prototype.transaction = function(fn) {
  var c = init();
  var self = this;
  var wrapped = c.transaction(function() {
    return fn(self);
  });
  return wrapped();
};

DBServiceImpl.prototype.scalar = function(sql, params) {
  var c = init();
  var bound = params || [];
  var result = c.prepare(sql).get(bound);
  return result ? result[Object.keys(result)[0]] : null;
};

DBServiceImpl.prototype.getConnection = function() {
  return init();
};

DBServiceImpl.prototype.poolAcquire = function() {
  return init();
};

DBServiceImpl.prototype.poolRelease = function(conn) {
  // Single connection — no-op
};

var service = new DBServiceImpl();

DBServiceImpl.prototype.close = function() {
  if (conn) {
    conn.close();
    conn = null;
  }
};

module.exports = service;
