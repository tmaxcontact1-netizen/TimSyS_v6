CREATE TABLE IF NOT EXISTS programme_manager_identity_resolutions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 response_id INTEGER NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','matched','ambiguous','unresolved')),
 student_record_id INTEGER,
 canonical_student_id TEXT,
 method TEXT,
 confidence INTEGER,
 evidence_json TEXT NOT NULL DEFAULT '{}',
 revision INTEGER NOT NULL DEFAULT 0,
 confirmed_by TEXT,
 confirmed_at TEXT,
 confirmation_reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(response_id) REFERENCES programme_manager_responses(id),
 FOREIGN KEY(student_record_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_identity_candidates (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 resolution_id INTEGER NOT NULL,
 resolution_revision INTEGER NOT NULL,
 student_record_id INTEGER NOT NULL,
 canonical_student_id TEXT NOT NULL,
 display_name TEXT NOT NULL,
 score INTEGER NOT NULL,
 signals_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(resolution_id,resolution_revision,student_record_id),
 FOREIGN KEY(resolution_id) REFERENCES programme_manager_identity_resolutions(id),
 FOREIGN KEY(student_record_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_identity_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 response_id INTEGER NOT NULL,
 resolution_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 from_revision INTEGER NOT NULL,
 to_revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(resolution_id) REFERENCES programme_manager_identity_resolutions(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_duplicate_cases (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 student_record_id INTEGER NOT NULL,
 canonical_student_id TEXT NOT NULL,
 response_ids_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 disposition TEXT CHECK(disposition IS NULL OR disposition IN ('primary_only','allow_multiple')),
 primary_response_id INTEGER,
 excluded_response_ids_json TEXT NOT NULL DEFAULT '[]',
 revision INTEGER NOT NULL DEFAULT 1,
 resolved_by TEXT,
 resolved_at TEXT,
 resolution_reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(survey_id,student_record_id),
 FOREIGN KEY(student_record_id) REFERENCES students(id),
 FOREIGN KEY(primary_response_id) REFERENCES programme_manager_responses(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_duplicate_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 survey_id INTEGER NOT NULL,
 duplicate_case_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 from_revision INTEGER NOT NULL,
 to_revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 reason TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(duplicate_case_id) REFERENCES programme_manager_duplicate_cases(id)
);

CREATE INDEX IF NOT EXISTS idx_programme_manager_identity_queue ON programme_manager_identity_resolutions(app_id,survey_id,status,response_id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_identity_student ON programme_manager_identity_resolutions(app_id,survey_id,student_record_id,status);
CREATE INDEX IF NOT EXISTS idx_programme_manager_identity_audit ON programme_manager_identity_audit(app_id,response_id,id DESC);
CREATE INDEX IF NOT EXISTS idx_programme_manager_duplicate_cases ON programme_manager_duplicate_cases(app_id,survey_id,status,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_duplicate_audit ON programme_manager_duplicate_audit(app_id,duplicate_case_id,id DESC);
