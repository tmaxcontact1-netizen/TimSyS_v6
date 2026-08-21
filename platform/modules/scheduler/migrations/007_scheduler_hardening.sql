ALTER TABLE scheduler_setups ADD COLUMN input_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE scheduler_versions ADD COLUMN input_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE scheduler_versions ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE scheduler_versions ADD COLUMN input_snapshot_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE scheduler_versions ADD COLUMN input_snapshot_hash TEXT;
ALTER TABLE scheduler_versions ADD COLUMN stale INTEGER NOT NULL DEFAULT 0 CHECK(stale IN (0,1));

CREATE TABLE IF NOT EXISTS scheduler_provider_records (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, scheduler_setup_id INTEGER NOT NULL,
 provider TEXT NOT NULL CHECK(provider IN ('programme_manager','teacher_preferences','cover','calendar','room_registry','inventory')),
 record_type TEXT NOT NULL, external_key TEXT NOT NULL, provider_version TEXT NOT NULL,
 effective_from TEXT, effective_to TEXT, payload_json TEXT NOT NULL, payload_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
 created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,scheduler_setup_id,provider,record_type,external_key), FOREIGN KEY(scheduler_setup_id) REFERENCES scheduler_setups(id),
 CHECK(effective_from IS NULL OR effective_to IS NULL OR effective_from<=effective_to)
);
CREATE TABLE IF NOT EXISTS scheduler_publication_jobs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, schedule_version_id INTEGER NOT NULL,
 idempotency_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
 cursor_placement_id INTEGER, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,idempotency_key), UNIQUE(app_id,schedule_version_id), FOREIGN KEY(schedule_version_id) REFERENCES scheduler_versions(id)
);
CREATE INDEX IF NOT EXISTS idx_scheduler_provider_records ON scheduler_provider_records(app_id,scheduler_setup_id,provider,status,effective_from,effective_to);
