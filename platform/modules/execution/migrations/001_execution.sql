CREATE TABLE IF NOT EXISTS execution_instances (
 id TEXT PRIMARY KEY,
 app_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision > 0),
 data_json TEXT NOT NULL CHECK(json_valid(data_json)),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_execution_scope ON execution_instances(app_id,updated_at);
-- An instance is the aggregate/transaction boundary. Canonical child entities retain
-- stable IDs in its versioned JSON document, matching the governed-record convention.
-- No Layer 1, existing Tasks or Documents records are written by this module.
CREATE TABLE IF NOT EXISTS execution_activity (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 instance_id TEXT NOT NULL REFERENCES execution_instances(id),
 revision INTEGER NOT NULL,
 actor_id TEXT NOT NULL,
 command_id TEXT NOT NULL,
 type TEXT NOT NULL,
 detail_json TEXT NOT NULL CHECK(json_valid(detail_json)),
 created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_execution_activity_instance ON execution_activity(instance_id,id);
CREATE INDEX IF NOT EXISTS idx_execution_activity_type ON execution_activity(instance_id,type,id);
CREATE TABLE IF NOT EXISTS execution_receipts (
 app_id TEXT NOT NULL,
 command_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 payload_hash TEXT NOT NULL,
 instance_id TEXT NOT NULL REFERENCES execution_instances(id),
 result_revision INTEGER NOT NULL,
 result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 PRIMARY KEY(app_id,command_id)
);
