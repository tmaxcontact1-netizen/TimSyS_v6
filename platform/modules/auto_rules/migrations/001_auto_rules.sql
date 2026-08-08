-- Path: /home/tmax/TimSyS_v6/platform/modules/auto_rules/migrations/001_auto_rules.sql
-- Migration: auto_rules_001_init
-- Purpose: Mined pattern rules with confidence scoring and lifecycle

CREATE TABLE IF NOT EXISTS auto_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_key TEXT NOT NULL,
    description TEXT NOT NULL,
    condition_type TEXT NOT NULL CHECK(condition_type IN ('threshold', 'frequency', 'trend', 'correlation')),
    condition_data TEXT DEFAULT '{}',
    source_data TEXT DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested', 'approved', 'rejected', 'active', 'archived')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auto_rules_status ON auto_rules(status);
CREATE INDEX IF NOT EXISTS idx_auto_rules_key ON auto_rules(rule_key);
CREATE INDEX IF NOT EXISTS idx_auto_rules_confidence ON auto_rules(confidence);
