CREATE TABLE IF NOT EXISTS grade_report_snapshots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',gradebook_id INTEGER NOT NULL,
 student_id TEXT NOT NULL,reporting_period_id INTEGER NOT NULL,version INTEGER NOT NULL,grade_result_id INTEGER NOT NULL,
 commentary_draft_id INTEGER NOT NULL,snapshot_json TEXT NOT NULL,content_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','published','rejected','withdrawn')),
 previous_snapshot_id INTEGER,created_by TEXT NOT NULL,submitted_by TEXT,approved_by TEXT,published_by TEXT,
 decision_reason TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),submitted_at TEXT,approved_at TEXT,published_at TEXT,
 FOREIGN KEY(gradebook_id) REFERENCES gradebook_instances(id),FOREIGN KEY(grade_result_id) REFERENCES grade_results(id),
 FOREIGN KEY(commentary_draft_id) REFERENCES academic_commentary_drafts(id),FOREIGN KEY(previous_snapshot_id) REFERENCES grade_report_snapshots(id),
 UNIQUE(gradebook_id,student_id,reporting_period_id,version)
);
CREATE INDEX idx_grade_reports_student ON grade_report_snapshots(gradebook_id,student_id,reporting_period_id,version);
