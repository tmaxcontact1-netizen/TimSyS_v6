CREATE TABLE IF NOT EXISTS programme_manager_allocation_decisions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 allocation_run_id INTEGER NOT NULL,
 recommendation_id INTEGER NOT NULL,
 response_id INTEGER NOT NULL,
 student_record_id INTEGER NOT NULL,
 canonical_student_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('accepted','rejected','manual_placement')),
 offering_id INTEGER,
 override_flags_json TEXT NOT NULL DEFAULT '[]',
 evidence_json TEXT NOT NULL DEFAULT '{}',
 reason TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 decided_by TEXT NOT NULL,
 decided_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,allocation_run_id,recommendation_id),
 FOREIGN KEY(allocation_run_id) REFERENCES programme_manager_allocation_runs(id),
 FOREIGN KEY(recommendation_id) REFERENCES programme_manager_allocation_recommendations(id),
 FOREIGN KEY(response_id) REFERENCES programme_manager_responses(id),
 FOREIGN KEY(student_record_id) REFERENCES students(id),
 FOREIGN KEY(offering_id) REFERENCES programme_manager_offerings(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_allocation_confirmations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 allocation_run_id INTEGER NOT NULL,
 input_hash TEXT NOT NULL,
 decision_snapshot_json TEXT NOT NULL,
 reason TEXT NOT NULL,
 confirmed_by TEXT NOT NULL,
 confirmed_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,allocation_run_id),
 FOREIGN KEY(allocation_run_id) REFERENCES programme_manager_allocation_runs(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_allocation_decision_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 allocation_run_id INTEGER NOT NULL,
 recommendation_id INTEGER,
 decision_id INTEGER,
 action TEXT NOT NULL,
 reason TEXT NOT NULL,
 snapshot_json TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(allocation_run_id) REFERENCES programme_manager_allocation_runs(id),
 FOREIGN KEY(recommendation_id) REFERENCES programme_manager_allocation_recommendations(id),
 FOREIGN KEY(decision_id) REFERENCES programme_manager_allocation_decisions(id)
);

CREATE INDEX IF NOT EXISTS idx_programme_manager_decision_queue ON programme_manager_allocation_decisions(app_id,allocation_run_id,action,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_decision_audit ON programme_manager_allocation_decision_audit(app_id,allocation_run_id,id DESC);
