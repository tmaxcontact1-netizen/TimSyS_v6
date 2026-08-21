CREATE TABLE IF NOT EXISTS programme_manager_offerings (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 external_key TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 scheduler_setup_id INTEGER NOT NULL,
 scheduler_window_id TEXT NOT NULL,
 scheduler_window_fingerprint TEXT NOT NULL,
 capacity_min INTEGER NOT NULL DEFAULT 0 CHECK(capacity_min>=0),
 capacity_max INTEGER NOT NULL CHECK(capacity_max>0),
 capacity_mode TEXT NOT NULL DEFAULT 'hard' CHECK(capacity_mode IN ('hard','advisory')),
 eligibility_json TEXT NOT NULL DEFAULT '{"open_to_all":true}',
 constraints_json TEXT NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ready','withdrawn')),
 previous_status TEXT CHECK(previous_status IS NULL OR previous_status IN ('draft','ready')),
 revision INTEGER NOT NULL DEFAULT 1,
 created_by TEXT NOT NULL,
 confirmed_by TEXT,
 confirmed_at TEXT,
 confirmation_reason TEXT,
 withdrawn_by TEXT,
 withdrawn_at TEXT,
 withdrawal_reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,programme_id,external_key),
 FOREIGN KEY(programme_id) REFERENCES programme_manager_programmes(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_offering_assignments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 offering_id INTEGER NOT NULL,
 entity_type TEXT NOT NULL CHECK(entity_type IN ('staff','room','resource')),
 entity_ref TEXT NOT NULL,
 quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity>0),
 availability_fingerprint TEXT NOT NULL,
 evidence_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(offering_id,entity_type,entity_ref),
 FOREIGN KEY(offering_id) REFERENCES programme_manager_offerings(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_offering_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 offering_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 from_revision INTEGER NOT NULL,
 to_revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(offering_id) REFERENCES programme_manager_offerings(id)
);

CREATE INDEX IF NOT EXISTS idx_programme_manager_offerings_programme ON programme_manager_offerings(app_id,programme_id,status,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_offering_window ON programme_manager_offerings(app_id,scheduler_setup_id,scheduler_window_id,status);
CREATE INDEX IF NOT EXISTS idx_programme_manager_assignments_ref ON programme_manager_offering_assignments(app_id,entity_type,entity_ref,offering_id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_offering_audit ON programme_manager_offering_audit(app_id,offering_id,id DESC);
