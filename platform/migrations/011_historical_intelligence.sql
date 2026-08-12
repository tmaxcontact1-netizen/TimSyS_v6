ALTER TABLE entity_withdrawals ADD COLUMN context_snapshot TEXT NOT NULL DEFAULT '{}';
ALTER TABLE insight_products ADD COLUMN provider_run_id TEXT;
ALTER TABLE insight_products ADD COLUMN fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_insight_fingerprint_active ON insight_products(fingerprint) WHERE fingerprint IS NOT NULL AND status NOT IN ('resolved','superseded','expired');

CREATE TABLE IF NOT EXISTS metric_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    unit TEXT NOT NULL,
    scope_types TEXT NOT NULL DEFAULT '[]',
    provider_id TEXT NOT NULL,
    provider_version TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS metric_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_id TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    value REAL NOT NULL,
    dimensions TEXT NOT NULL DEFAULT '{}',
    evidence TEXT NOT NULL DEFAULT '[]',
    calculated_at INTEGER NOT NULL,
    provider_run_id TEXT,
    UNIQUE(metric_id, scope_type, scope_id, period_start, period_end, dimensions)
);
CREATE INDEX IF NOT EXISTS idx_metric_series ON metric_points(metric_id, scope_type, scope_id, period_end);

CREATE TABLE IF NOT EXISTS provider_runs (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    provider_version TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    comparison_start INTEGER,
    comparison_end INTEGER,
    status TEXT NOT NULL,
    input_summary TEXT NOT NULL DEFAULT '{}',
    output_summary TEXT NOT NULL DEFAULT '{}',
    error TEXT,
    started_at INTEGER NOT NULL,
    completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_provider_runs_scope ON provider_runs(provider_id, scope_type, scope_id, completed_at);

