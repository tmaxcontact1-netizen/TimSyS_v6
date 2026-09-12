CREATE TABLE IF NOT EXISTS ai_gateway_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, purpose TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
 prompt_version TEXT NOT NULL, evidence_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('running','completed','failed','rejected')),
 confidence REAL, evidence_ids_json TEXT NOT NULL DEFAULT '[]', limitations_json TEXT NOT NULL DEFAULT '[]', error_message TEXT,
 requested_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_gateway_runs ON ai_gateway_runs(app_id,purpose,status,created_at);
