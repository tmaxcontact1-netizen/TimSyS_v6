CREATE TABLE IF NOT EXISTS programme_manager_enrolment_batches (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, programme_id INTEGER NOT NULL, survey_id INTEGER NOT NULL,
 allocation_run_id INTEGER NOT NULL, confirmation_id INTEGER NOT NULL, input_hash TEXT NOT NULL,
 active_count INTEGER NOT NULL, rejected_count INTEGER NOT NULL, reason TEXT NOT NULL, published_by TEXT NOT NULL,
 published_at TEXT NOT NULL DEFAULT(datetime('now')), UNIQUE(app_id,confirmation_id),
 FOREIGN KEY(confirmation_id) REFERENCES programme_manager_allocation_confirmations(id)
);
CREATE TABLE IF NOT EXISTS programme_manager_enrolments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, programme_id INTEGER NOT NULL, survey_id INTEGER NOT NULL,
 offering_id INTEGER NOT NULL, scheduler_window_id TEXT NOT NULL, student_record_id INTEGER NOT NULL,
 canonical_student_id TEXT NOT NULL, response_id INTEGER NOT NULL, decision_id INTEGER NOT NULL, enrolment_batch_id INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')), revision INTEGER NOT NULL DEFAULT 1,
 previous_status TEXT, withdrawal_reason TEXT, withdrawn_by TEXT, withdrawn_at TEXT,
 created_at TEXT NOT NULL DEFAULT(datetime('now')), updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,decision_id), UNIQUE(app_id,programme_id,scheduler_window_id,student_record_id),
 FOREIGN KEY(offering_id) REFERENCES programme_manager_offerings(id), FOREIGN KEY(student_record_id) REFERENCES students(id),
 FOREIGN KEY(decision_id) REFERENCES programme_manager_allocation_decisions(id), FOREIGN KEY(enrolment_batch_id) REFERENCES programme_manager_enrolment_batches(id)
);
CREATE TABLE IF NOT EXISTS programme_manager_enrolment_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, enrolment_id INTEGER NOT NULL, action TEXT NOT NULL,
 reason TEXT NOT NULL, snapshot_json TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(enrolment_id) REFERENCES programme_manager_enrolments(id)
);
CREATE TABLE IF NOT EXISTS programme_manager_attendance_handoffs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, app_id TEXT NOT NULL, programme_id INTEGER NOT NULL, offering_id INTEGER NOT NULL,
 external_key TEXT NOT NULL, title TEXT NOT NULL, starts_at TEXT, ends_at TEXT, roster_hash TEXT NOT NULL,
 roster_snapshot_json TEXT NOT NULL, attendance_session_id INTEGER, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed')),
 error_message TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(datetime('now')), completed_at TEXT,
 UNIQUE(app_id,offering_id,external_key), FOREIGN KEY(offering_id) REFERENCES programme_manager_offerings(id),
 FOREIGN KEY(attendance_session_id) REFERENCES attendance_sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_programme_manager_enrolments ON programme_manager_enrolments(app_id,offering_id,status,canonical_student_id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_enrolment_audit ON programme_manager_enrolment_audit(app_id,enrolment_id,id DESC);
CREATE INDEX IF NOT EXISTS idx_programme_manager_attendance_handoffs ON programme_manager_attendance_handoffs(app_id,offering_id,status,id DESC);
