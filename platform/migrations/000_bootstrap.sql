-- Migration: 000_bootstrap
-- Created: 2026-07-16
-- Purpose: Establish migration tracking table before any other migrations

CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT UNIQUE NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);