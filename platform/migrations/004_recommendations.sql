-- Migration: 004_recommendations
-- Created: 2026-07-19
-- Purpose: Recommendations persistence table (Phase 11)

CREATE TABLE IF NOT EXISTS recommendations (
    id TEXT PRIMARY KEY,
    suggestions_data TEXT NOT NULL,
    generated_at INTEGER NOT NULL,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_generated ON recommendations(generated_at);
