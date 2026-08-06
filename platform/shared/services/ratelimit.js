'use strict';

const db = require('./db');

function initTable() {
  db.exec("CREATE TABLE IF NOT EXISTS rate_limit (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, count INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL, updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000))");
  db.exec("CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit(key)");
}

function recordRequest(key, windowMs, maxRequests) {
  var now = Date.now();
  var row = db.query('SELECT count, window_start FROM rate_limit WHERE key = ?', [key]).rows[0];

  if (!row) {
    db.query('INSERT INTO rate_limit (key, count, window_start) VALUES (?, ?, ?)', [key, 1, now]);
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  var isWindowExpired = now - row.window_start > windowMs;
  var currentCount = isWindowExpired ? 0 : row.count;
  var effectiveWindowStart = isWindowExpired ? now : row.window_start;

  if (currentCount >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: effectiveWindowStart + windowMs };
  }

  var newCount = currentCount + 1;
  db.query('UPDATE rate_limit SET count = ?, window_start = ?, updated_at = ? WHERE key = ?', [newCount, effectiveWindowStart, now, key]);
  return { allowed: true, remaining: maxRequests - newCount, resetAt: effectiveWindowStart + windowMs };
}

function getKey(userId, limitTier) {
  return userId + ':' + limitTier;
}

module.exports = { initTable, recordRequest, getKey };