-- Path: /home/tmax/TimSyS_v6/platform/modules/relationship_registry/migrations/001_relationships.sql
-- Migration: relationship_registry_001_init
-- Purpose: Entity relationship mapping for structural awareness

CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_rel_active ON relationships(active);
