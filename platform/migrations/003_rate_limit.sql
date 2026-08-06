-- Migration: 003_rate_limit
-- Created: 2026-07-18
-- Purpose: Persistent rate limiting storage

CREATE TABLE IF NOT EXISTS rate_limit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit(key);
