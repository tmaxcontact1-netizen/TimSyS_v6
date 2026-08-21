CREATE TABLE IF NOT EXISTS cover_policies (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT 'School cover policy',
 policy_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
 updated_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE TABLE IF NOT EXISTS cover_policy_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, policy_id INTEGER NOT NULL, revision INTEGER NOT NULL,
 policy_json TEXT NOT NULL, change_reason TEXT NOT NULL, changed_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,policy_id,revision), FOREIGN KEY(policy_id) REFERENCES cover_policies(id)
);
CREATE INDEX IF NOT EXISTS idx_cover_policy_history ON cover_policy_history(app_id,policy_id,revision DESC);
