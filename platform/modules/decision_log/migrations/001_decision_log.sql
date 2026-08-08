-- Path: /home/tmax/TimSyS_v6/platform/modules/decision_log/migrations/001_decision_log.sql
-- Migration: decision_log_001_init
-- Purpose: Administrative decision tracking with context, rationale, and outcomes

CREATE TABLE IF NOT EXISTS decision_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    context TEXT DEFAULT '{}',
    rationale TEXT,
    outcome TEXT,
    related_decision_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decision_log_actor ON decision_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_entity ON decision_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_action ON decision_log(action);
CREATE INDEX IF NOT EXISTS idx_decision_log_created ON decision_log(created_at);
CREATE INDEX IF NOT EXISTS idx_decision_log_related ON decision_log(related_decision_id);
