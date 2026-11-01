ALTER TABLE ai_gateway_runs ADD COLUMN result_json TEXT;
ALTER TABLE ai_gateway_runs ADD COLUMN usage_json TEXT;

CREATE TABLE IF NOT EXISTS ai_adapters (
 app_id TEXT PRIMARY KEY, definition_json TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_watches (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, owner_id TEXT NOT NULL,
 workflow TEXT NOT NULL, instructions TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
 cooldown_seconds INTEGER NOT NULL DEFAULT 300, daily_limit INTEGER NOT NULL DEFAULT 20,
 last_run_at INTEGER, created_at INTEGER NOT NULL,
 UNIQUE(app_id, owner_id, workflow)
);
CREATE TABLE IF NOT EXISTS ai_watch_jobs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, watch_id INTEGER NOT NULL REFERENCES ai_watches(id),
 event_id TEXT NOT NULL, evidence_hash TEXT NOT NULL, evidence_json TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','completed','failed','cancelled')),
 attempts INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL, lease_until INTEGER,
 run_id INTEGER REFERENCES ai_gateway_runs(id), error_code TEXT, created_at INTEGER NOT NULL,
 UNIQUE(watch_id, event_id), UNIQUE(watch_id, evidence_hash)
);
CREATE TABLE IF NOT EXISTS ai_adviser_notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL UNIQUE REFERENCES ai_watch_jobs(id),
 app_id TEXT NOT NULL, owner_id TEXT NOT NULL, run_id INTEGER NOT NULL REFERENCES ai_gateway_runs(id),
 status TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread','read','dismissed')), created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_watch_pending ON ai_watch_jobs(state, available_at);
CREATE INDEX IF NOT EXISTS idx_ai_notifications_owner ON ai_adviser_notifications(app_id,owner_id,status);
