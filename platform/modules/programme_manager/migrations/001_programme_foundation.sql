CREATE TABLE IF NOT EXISTS programme_manager_programmes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL DEFAULT 'principal-ed',
 external_key TEXT NOT NULL,
 academic_year_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 programme_type TEXT NOT NULL,
 operating_mode TEXT,
 respondent_mode TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','configured','active','closed','withdrawn','archived')),
 previous_status TEXT CHECK(previous_status IS NULL OR previous_status IN ('draft','configured','active','closed')),
 configuration_json TEXT NOT NULL DEFAULT '{}',
 revision INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL,
 withdrawn_by TEXT,
 withdrawn_at TEXT,
 withdrawal_reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,external_key),
 FOREIGN KEY(academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('created','revised','withdrawn','reinstated','configured','activated','closed','archived')),
 from_status TEXT,
 to_status TEXT NOT NULL,
 reason TEXT,
 revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(programme_id) REFERENCES programme_manager_programmes(id)
);

CREATE INDEX IF NOT EXISTS idx_programme_manager_programmes_scope ON programme_manager_programmes(app_id,academic_year_id,status,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_audit_programme ON programme_manager_audit(app_id,programme_id,id DESC);
