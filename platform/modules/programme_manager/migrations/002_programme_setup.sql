CREATE TABLE IF NOT EXISTS programme_manager_setup (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','ready','confirmed')),
 current_step TEXT NOT NULL DEFAULT 'purpose',
 purpose_json TEXT,
 timing_json TEXT,
 location_json TEXT,
 participation_json TEXT,
 governance_json TEXT,
 completed_steps_json TEXT NOT NULL DEFAULT '[]',
 scheduler_fingerprint TEXT,
 revision INTEGER NOT NULL DEFAULT 0,
 confirmed_by TEXT,
 confirmed_at TEXT,
 confirmation_reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,programme_id),
 FOREIGN KEY(programme_id) REFERENCES programme_manager_programmes(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_setup_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 setup_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 step TEXT,
 from_revision INTEGER NOT NULL,
 to_revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(programme_id) REFERENCES programme_manager_programmes(id),
 FOREIGN KEY(setup_id) REFERENCES programme_manager_setup(id)
);

CREATE INDEX IF NOT EXISTS idx_programme_manager_setup_scope ON programme_manager_setup(app_id,status,programme_id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_setup_audit ON programme_manager_setup_audit(app_id,programme_id,id DESC);
