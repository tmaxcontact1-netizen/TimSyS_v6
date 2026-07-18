-- Migration: intelligence_002_intelligence
-- Purpose: Tables for intelligence service (metadata catalog, insights storage, logic rules)

CREATE TABLE IF NOT EXISTS intelligence_metadata (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    classifications TEXT NOT NULL DEFAULT '[]',
    confidence REAL NOT NULL DEFAULT 0,
    data_snapshot TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_intelligence_metadata_entity ON intelligence_metadata(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_metadata_tags ON intelligence_metadata(tags);

CREATE TABLE IF NOT EXISTS intelligence_insights (
    id TEXT PRIMARY KEY,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    metrics_data TEXT NOT NULL DEFAULT '{}',
    trends_data TEXT NOT NULL DEFAULT '[]',
    alerts TEXT NOT NULL DEFAULT '[]',
    generated_at INTEGER NOT NULL,
    expires_at INTEGER,
    UNIQUE(id)
);

CREATE INDEX IF NOT EXISTS idx_intelligence_insights_scope ON intelligence_insights(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_insights_type ON intelligence_insights(insight_type);

CREATE TABLE IF NOT EXISTS intelligence_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    conditions TEXT NOT NULL DEFAULT '{}',
    actions TEXT NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_triggered_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_intelligence_rules_priority ON intelligence_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_rules_enabled ON intelligence_rules(enabled);