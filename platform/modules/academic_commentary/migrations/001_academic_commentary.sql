CREATE TABLE IF NOT EXISTS academic_commentary_drafts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,app_id TEXT NOT NULL DEFAULT 'principal-ed',gradebook_id INTEGER NOT NULL,
 student_id TEXT NOT NULL,reporting_period_id INTEGER,grade_result_id INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,
 content TEXT NOT NULL,input_snapshot_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ready','withdrawn')),
 generated INTEGER NOT NULL DEFAULT 1 CHECK(generated IN (0,1)),created_by TEXT NOT NULL,supersedes_id INTEGER,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(gradebook_id) REFERENCES gradebook_instances(id),FOREIGN KEY(grade_result_id) REFERENCES grade_results(id),
 FOREIGN KEY(supersedes_id) REFERENCES academic_commentary_drafts(id),UNIQUE(gradebook_id,student_id,reporting_period_id,version)
);
CREATE INDEX idx_commentary_current ON academic_commentary_drafts(gradebook_id,student_id,reporting_period_id,status,version);
