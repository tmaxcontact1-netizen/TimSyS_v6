CREATE TABLE IF NOT EXISTS programme_manager_allocation_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 publication_id INTEGER NOT NULL,
 external_key TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'generated' CHECK(status IN ('generated','superseded')),
 input_hash TEXT NOT NULL,
 input_snapshot_json TEXT NOT NULL,
 summary_json TEXT NOT NULL,
 response_count INTEGER NOT NULL,
 eligible_response_count INTEGER NOT NULL,
 recommendation_count INTEGER NOT NULL,
 review_count INTEGER NOT NULL,
 unplaced_count INTEGER NOT NULL,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 UNIQUE(app_id,survey_id,external_key),
 FOREIGN KEY(survey_id) REFERENCES programme_manager_surveys(id),
 FOREIGN KEY(publication_id) REFERENCES programme_manager_survey_publications(id)
);

CREATE TABLE IF NOT EXISTS programme_manager_allocation_recommendations (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 app_id TEXT NOT NULL,
 programme_id INTEGER NOT NULL,
 survey_id INTEGER NOT NULL,
 allocation_run_id INTEGER NOT NULL,
 response_id INTEGER NOT NULL,
 student_record_id INTEGER,
 canonical_student_id TEXT,
 scheduler_window_id TEXT,
 unique_group TEXT,
 recommended_offering_id INTEGER,
 preference_rank INTEGER,
 state TEXT NOT NULL CHECK(state IN ('recommended','review_required','unplaced','excluded')),
 reason_code TEXT NOT NULL,
 evidence_json TEXT NOT NULL,
 priority_timestamp TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 FOREIGN KEY(allocation_run_id) REFERENCES programme_manager_allocation_runs(id),
 FOREIGN KEY(response_id) REFERENCES programme_manager_responses(id),
 FOREIGN KEY(student_record_id) REFERENCES students(id),
 FOREIGN KEY(recommended_offering_id) REFERENCES programme_manager_offerings(id)
);

CREATE INDEX IF NOT EXISTS idx_programme_manager_allocation_runs ON programme_manager_allocation_runs(app_id,survey_id,status,id DESC);
CREATE INDEX IF NOT EXISTS idx_programme_manager_allocation_results ON programme_manager_allocation_recommendations(app_id,allocation_run_id,state,priority_timestamp,id);
CREATE INDEX IF NOT EXISTS idx_programme_manager_allocation_student ON programme_manager_allocation_recommendations(app_id,survey_id,student_record_id,state,id);
