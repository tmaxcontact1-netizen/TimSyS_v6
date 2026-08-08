-- Path: /home/tmax/TimSyS_v6/platform/modules/snapshot_service/migrations/001_snapshots.sql
-- Migration: snapshot_service_001_init
-- Purpose: Periodic synthesis snapshots for trend analysis

CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    metric_key TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snapshots_run ON snapshots(run_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_key ON snapshots(metric_key);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured ON snapshots(captured_at);
