CREATE TABLE IF NOT EXISTS grade_results (
 id INTEGER PRIMARY KEY AUTOINCREMENT,gradebook_id INTEGER NOT NULL,student_id TEXT NOT NULL,reporting_period_id INTEGER,
 policy_id INTEGER NOT NULL,policy_version INTEGER NOT NULL,model TEXT NOT NULL,
 numeric_result REAL,text_result TEXT,completeness REAL NOT NULL,confidence TEXT NOT NULL CHECK(confidence IN ('insufficient','low','moderate','high')),
 explanation_json TEXT NOT NULL,source_evidence_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'calculated' CHECK(status IN ('calculated','overridden','superseded')),
 overridden_value TEXT,override_reason TEXT,overridden_by TEXT,calculated_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(gradebook_id) REFERENCES gradebook_instances(id),FOREIGN KEY(policy_id) REFERENCES evaluation_policies(id)
);
CREATE TABLE IF NOT EXISTS standard_mastery_results (
 id INTEGER PRIMARY KEY AUTOINCREMENT,grade_result_id INTEGER NOT NULL,standard_id INTEGER NOT NULL,numeric_result REAL,text_result TEXT,
 evidence_count INTEGER NOT NULL,confidence TEXT NOT NULL,source_evidence_json TEXT NOT NULL,
 FOREIGN KEY(grade_result_id) REFERENCES grade_results(id),FOREIGN KEY(standard_id) REFERENCES learning_standards(id)
);
CREATE INDEX IF NOT EXISTS idx_grade_results_student ON grade_results(gradebook_id,student_id,reporting_period_id,calculated_at);
