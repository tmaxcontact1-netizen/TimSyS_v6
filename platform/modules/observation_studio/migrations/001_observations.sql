CREATE TABLE IF NOT EXISTS observation_settings (
 app_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, data_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS observation_records (
 id TEXT PRIMARY KEY, app_id TEXT NOT NULL, revision INTEGER NOT NULL, data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS observation_app ON observation_records(app_id);
CREATE TABLE IF NOT EXISTS observation_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, record_id TEXT,
 actor_id TEXT NOT NULL, action TEXT NOT NULL, revision INTEGER NOT NULL,
 detail_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE IF NOT EXISTS observation_receipts (
 app_id TEXT NOT NULL, command_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 payload_hash TEXT NOT NULL, record_id TEXT, PRIMARY KEY(app_id,command_id)
);
INSERT OR IGNORE INTO app_module_assignments(app_id,module_name)
SELECT 'principal-ed','observation_studio'
WHERE EXISTS(SELECT 1 FROM app_module_assignments WHERE app_id='principal-ed');
